import { NextResponse } from "next/server";
import { createClient } from "@/lib/data/supabase/server";
import { requireUser } from "@/lib/data/auth";
import {
  listCareerEntries,
  listVoiceSamples,
  getUserSettings,
} from "@/lib/data/queries/career";
import { getJob, updateJob } from "@/lib/data/queries/jobs";
import {
  createDocument,
  getDocument,
  nextDocumentVersion,
  updateDocumentDraft,
} from "@/lib/data/queries/documents";
import {
  AiUnavailableError,
  AiValidationError,
} from "@/lib/intelligence/deepseek";
import {
  runFitReport,
  type FitReport,
} from "@/lib/intelligence/tasks/fit-report";
import {
  runDraftCv,
  NoAllowedEntriesError,
} from "@/lib/intelligence/tasks/draft-cv";
import { runDraftCoverLetter } from "@/lib/intelligence/tasks/draft-cover-letter";
import { runClaimCheck } from "@/lib/intelligence/tasks/claim-check";
import {
  cvDraftLines,
  coverLetterDraftLines,
  coverLetterWordCount,
  type CoverLetterDraft,
  type CvDraft,
} from "@/lib/intelligence/drafts";
import {
  checkBannedPhrases,
  flaggedTexts,
  toEntryText,
  validateDraft,
  type DraftLine,
  type EntryText,
  type Violation,
} from "@/lib/intelligence/validate";
import { runReviseLines } from "@/lib/intelligence/tasks/revise";
import {
  coverLetterContentSchema,
  cvContentSchema,
  extractPartLines,
  partSchema,
  splicePart,
} from "@/lib/operations/document-parts";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * POST /api/jobs/[id]/tailor  -  the tailoring pipeline (Prompt 6).
 *
 * Steps (each a separate server call, each re-validated server-side):
 *   { step: "fit" }                       -> fit report
 *   { step: "draft", kind, allowed_entry_ids, fit_report? }
 *                                         -> draft + validate + one
 *                                            regeneration round, saved as a
 *                                            new draft version
 *   { step: "claim_check", document_id }  -> re-run all checks on a draft
 *
 * The model's output is never trusted: source ids are validated against the
 * entries in the database, and numbers, dates, proper nouns and banned
 * phrases are re-checked deterministically. Flagged lines stay flagged;
 * approval is blocked while flags exist (Prompt 7 UI).
 */

type Body = {
  step?: string;
  kind?: string;
  allowed_entry_ids?: unknown;
  fit_report?: unknown;
  document_id?: unknown;
  instruction?: unknown;
  part?: unknown;
  content_json?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id: jobId } = await params;

  const limiter = rateLimit(`tailor:${user.id}`, 10, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${limiter.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
    );
  }

  // The job id comes from the URL: confirm it exists and belongs to this
  // user before anything else.
  const job = await getJob(supabase, jobId);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const entries = await listCareerEntries(supabase);
  const entriesById = new Map(entries.map((e) => [e.id, toEntryText(e)]));

  try {
    if (body.step === "fit") {
      const fitReport = await runFitReport(
        requireDescription(job),
        Array.from(entriesById.values()),
      );
      return NextResponse.json({ fit_report: fitReport });
    }

    if (body.step === "draft") {
      const kind = body.kind === "cover_letter" ? "cover_letter" : "cv";
      const allowed = parseAllowedIds(body.allowed_entry_ids);
      if (allowed.size === 0) {
        return NextResponse.json(
          { error: "Select at least one entry to use." },
          { status: 400 },
        );
      }
      for (const allowedId of allowed) {
        if (!entriesById.has(allowedId)) {
          return NextResponse.json(
            { error: "One of the selected entries does not exist." },
            { status: 400 },
          );
        }
      }

      const allowedEntries = Array.from(allowed).map((allowedId) =>
        entriesById.get(allowedId)!,
      );
      const jobText = requireDescription(job);

      let result =
        kind === "cv"
          ? await draftCvWithChecks(jobText, job, allowedEntries, entriesById, allowed)
          : await draftLetterWithChecks({
              jobText,
              job,
              allowedEntries,
              entriesById,
              allowed,
              voiceSamples: await listVoiceSamples(supabase),
            });

      // One regeneration round for flagged lines; whatever still fails is
      // returned flagged and can never be approved (Prompt 7 blocks it).
      if (result.violations.length > 0) {
        const rejected = flaggedTexts(result.violations);
        result =
          kind === "cv"
            ? await draftCvWithChecks(
                jobText,
                job,
                allowedEntries,
                entriesById,
                allowed,
                rejected,
              )
            : await draftLetterWithChecks({
                jobText,
                job,
                allowedEntries,
                entriesById,
                allowed,
                voiceSamples: await listVoiceSamples(supabase),
                rejectedLines: rejected,
              });
      }

      const version = await nextDocumentVersion(supabase, jobId, kind);
      const document = await createDocument(supabase, {
        user_id: user.id,
        job_id: jobId,
        kind,
        version,
        template: "bi_commercial",
        content_json: result.draft,
        source_map: {
          allowed_entry_ids: Array.from(allowed),
          fit_report: sanitiseFitReport(body.fit_report),
          violations: result.violations,
        },
      });

      return NextResponse.json({ document });
    }

    if (body.step === "claim_check") {
      const documentId = parseId(body.document_id);
      if (!documentId) {
        return NextResponse.json({ error: "No document id." }, { status: 400 });
      }
      const document = await getDocument(supabase, documentId);
      if (!document || document.user_id !== user.id || document.job_id !== jobId) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }
      if (document.status !== "draft") {
        return NextResponse.json(
          { error: "This version is locked; run the check on a new version." },
          { status: 400 },
        );
      }

      const lines = documentLines(document.kind, document.content_json);
      const citedIds = new Set(
        lines.flatMap((line) => line.entry_ids).filter((id) => entriesById.has(id)),
      );
      const { violations } = validateDraft(lines, entriesById, citedIds);
      violations.push(
        ...checkBannedPhrases(
          lines,
          (await getUserSettings(supabase, user.id))?.banned_phrases ?? [],
        ),
      );
      if (violations.length === 0) {
        const issues = await runClaimCheck(lines, entriesById);        violations.push(
          ...issues.map((issue) => ({
            text: issue.text,
            entry_ids:
              lines.find((l) => l.text === issue.text)?.entry_ids ?? [],
            reason: "ai_flagged" as const,
            detail: issue.reason,
          })),
        );
      }

      const sourceMap = (document.source_map ?? {}) as Record<string, unknown>;
      await updateDocumentDraft(supabase, document.id, {
        source_map: { ...sourceMap, violations },
      });

      return NextResponse.json({ violations });
    }

    if (body.step === "revise") {
      // "Ask for changes": regenerate only the affected part of a draft and
      // save the result as a NEW version (every regeneration does).
      const loaded = await loadOwnedDraft(supabase, user.id, jobId, body.document_id);
      if ("error" in loaded) return loaded.error;
      const document = loaded.document;

      const parsedPart = partSchema.safeParse(body.part);
      if (!parsedPart.success) {
        return NextResponse.json({ error: "Unknown part." }, { status: 400 });
      }
      const instruction =
        typeof body.instruction === "string" ? body.instruction.trim() : "";
      if (!instruction) {
        return NextResponse.json(
          { error: "Type an instruction first." },
          { status: 400 },
        );
      }

      const allowed = new Set(
        ((document.source_map ?? {}) as { allowed_entry_ids?: string[] })
          .allowed_entry_ids ?? [],
      );
      const draft =
        document.kind === "cv"
          ? (document.content_json as CvDraft)
          : (document.content_json as CoverLetterDraft);

      const partLines = extractPartLines(document.kind, draft, parsedPart.data);
      if (partLines.length === 0) {
        return NextResponse.json(
          { error: "That part has nothing to revise." },
          { status: 400 },
        );
      }

      const allowedEntries = Array.from(allowed).map((allowedId) =>
        entriesById.get(allowedId),
      ).filter((e): e is EntryText => Boolean(e));

      const replacements = await runReviseLines({
        lines: partLines,
        instruction,
        allowedEntries,
      });

      const updatedDraft = splicePart(
        document.kind,
        draft,
        parsedPart.data,
        replacements,
      );

      const violations = await fullChecks(
        supabase,
        user.id,
        document.kind,
        updatedDraft,
        entriesById,
        allowed,
      );

      const version = await nextDocumentVersion(supabase, jobId, document.kind);
      const newDocument = await createDocument(supabase, {
        user_id: user.id,
        job_id: jobId,
        kind: document.kind,
        version,
        parent_version_id: document.id,
        template: document.template ?? "bi_commercial",
        content_json: updatedDraft,
        source_map: {
          ...((document.source_map ?? {}) as Record<string, unknown>),
          violations,
          revised_part: parsedPart.data,
        },
      });

      return NextResponse.json({ document: newDocument, violations });
    }

    if (body.step === "save_manual") {
      // Hand edits also create a new version, re-validated end to end. On an
      // approved version this is how a new editable version is forked off;
      // the approved row itself is never modified.
      const loaded = await loadOwnedDraft(
        supabase,
        user.id,
        jobId,
        body.document_id,
        true,
      );
      if ("error" in loaded) return loaded.error;
      const document = loaded.document;

      const parsedContent =
        document.kind === "cv"
          ? cvContentSchema.safeParse(body.content_json)
          : coverLetterContentSchema.safeParse(body.content_json);
      if (!parsedContent.success) {
        return NextResponse.json(
          { error: "The edited document is incomplete or malformed." },
          { status: 400 },
        );
      }

      const allowed = new Set(
        ((document.source_map ?? {}) as { allowed_entry_ids?: string[] })
          .allowed_entry_ids ?? [],
      );
      const violations = await fullChecks(
        supabase,
        user.id,
        document.kind,
        parsedContent.data,
        entriesById,
        allowed,
      );

      const version = await nextDocumentVersion(supabase, jobId, document.kind);
      const newDocument = await createDocument(supabase, {
        user_id: user.id,
        job_id: jobId,
        kind: document.kind,
        version,
        parent_version_id: document.id,
        template: document.template ?? "bi_commercial",
        content_json: parsedContent.data,
        source_map: {
          ...((document.source_map ?? {}) as Record<string, unknown>),
          violations,
          edited_by_hand: true,
        },
      });

      return NextResponse.json({ document: newDocument, violations });
    }

    if (body.step === "approve") {
      // Approval runs every check again; a version with flagged lines can
      // never be locked.
      const loaded = await loadOwnedDraft(supabase, user.id, jobId, body.document_id);
      if ("error" in loaded) return loaded.error;
      const document = loaded.document;

      const allowed = new Set(
        ((document.source_map ?? {}) as { allowed_entry_ids?: string[] })
          .allowed_entry_ids ?? [],
      );
      const violations = await fullChecks(
        supabase,
        user.id,
        document.kind,
        document.content_json,
        entriesById,
        allowed,
      );
      if (violations.length > 0) {
        return NextResponse.json(
          {
            error:
              "This version still has flagged lines. Fix them before approving.",
            violations,
          },
          { status: 400 },
        );
      }

      const approved = await updateDocumentDraft(supabase, document.id, {
        status: "approved",
      });

      // Spec: jobs move to Ready when a CV is approved (never backwards past
      // Ready into Applied territory).
      if (
        document.kind === "cv" &&
        ["saved", "tailoring"].includes(job.status)
      ) {
        await updateJob(supabase, jobId, { status: "ready" });
      }

      return NextResponse.json({ document: approved });
    }

    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  } catch (err) {
    if (err instanceof MissingDescriptionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof NoAllowedEntriesError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(
      "tailoring failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

class MissingDescriptionError extends Error {
  constructor() {
    super("This job has no pasted description to work from. Add one first.");
    this.name = "MissingDescriptionError";
  }
}

/**
 * Loads a document for the given job and owner, or an error response.
 * Ids from the browser are never trusted: kind, job and user must all match.
 * Hand-edited saves are allowed on approved versions (that is how "create a
 * new version from this one" works); the approved row itself is never
 * touched, and revisions stay draft-only.
 */
async function loadOwnedDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobId: string,
  rawId: unknown,
  allowApproved = false,
) {
  const documentId = parseId(rawId);
  const document = documentId ? await getDocument(supabase, documentId) : null;
  if (
    !document ||
    document.user_id !== userId ||
    document.job_id !== jobId
  ) {
    return {
      error: NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      ),
    };
  }
  if (document.status !== "draft" && !allowApproved) {
    return {
      error: NextResponse.json(
        {
          error:
            "Approved versions are locked. Create a new version from this one to make changes.",
        },
        { status: 400 },
      ),
    };
  }
  return { document };
}

/**
 * Every check a draft must pass: deterministic source/number/date/proper-noun
 * validation, banned phrases, then the AI claim check (only when the
 * deterministic checks are clean, so the model sees the honest remainder).
 */
async function fullChecks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  kind: string,
  contentJson: unknown,
  entriesById: Map<string, EntryText>,
  allowed: Set<string>,
): Promise<Violation[]> {
  const lines: DraftLine[] = documentLines(kind, contentJson);
  const { violations } = validateDraft(lines, entriesById, allowed);
  if (violations.length > 0) return violations;

  violations.push(
    ...checkBannedPhrases(
      lines,
      (await getUserSettings(supabase, userId))?.banned_phrases ?? [],
    ),
  );
  if (violations.length > 0) return violations;

  const issues = await runClaimCheck(lines, entriesById);
  violations.push(
    ...issues.map((issue) => ({
      text: issue.text,
      entry_ids: lines.find((l) => l.text === issue.text)?.entry_ids ?? [],
      reason: "ai_flagged" as const,
      detail: issue.reason,
    })),
  );
  return violations;
}

function requireDescription(job: { description: string | null }): string {
  const text = job.description?.trim() ?? "";
  if (text.length < 50) throw new MissingDescriptionError();
  return text;
}

function parseAllowedIds(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.filter((v): v is string => typeof v === "string" && v.length === 36).slice(0, 60),
  );
}

function parseId(raw: unknown): string | null {
  return typeof raw === "string" && raw.length === 36 ? raw : null;
}

function sanitiseFitReport(raw: unknown): FitReport | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { summary?: unknown; requirements?: unknown };
  if (typeof candidate.summary !== "string" || !Array.isArray(candidate.requirements)) {
    return null;
  }
  if (JSON.stringify(raw).length > 40_000) return null;
  return raw as FitReport;
}

function documentLines(kind: string, contentJson: unknown) {
  return kind === "cv"
    ? cvDraftLines(contentJson as CvDraft)
    : coverLetterDraftLines(contentJson as CoverLetterDraft);
}

async function draftCvWithChecks(
  jobText: string,
  job: { title: string | null; company: string | null },
  allowedEntries: EntryText[],
  entriesById: Map<string, EntryText>,
  allowed: Set<string>,
  rejectedLines: string[] = [],
): Promise<{ draft: CvDraft; violations: Violation[] }> {
  const draft = await runDraftCv({
    jobText,
    jobTitle: job.title ?? "",
    company: job.company ?? "",
    allowedEntries,
    rejectedLines,
  });

  // Flagged lines stay in the draft and are recorded; the review UI shows
  // them and blocks approval while any remain.
  const { violations } = validateDraft(cvDraftLines(draft), entriesById, allowed);
  return { draft, violations };
}

async function draftLetterWithChecks({
  jobText,
  job,
  allowedEntries,
  entriesById,
  allowed,
  voiceSamples,
  rejectedLines = [],
}: {
  jobText: string;
  job: { title: string | null; company: string | null };
  allowedEntries: EntryText[];
  entriesById: Map<string, EntryText>;
  allowed: Set<string>;
  voiceSamples: { label: string; content: string }[];
  rejectedLines?: string[];
}): Promise<{ draft: CoverLetterDraft; violations: Violation[] }> {
  const draft = await runDraftCoverLetter({
    jobText,
    jobTitle: job.title ?? "",
    company: job.company ?? "",
    allowedEntries,
    voiceSamples,
    rejectedLines,
  });

  const { violations } = validateDraft(
    coverLetterDraftLines(draft),
    entriesById,
    allowed,
  );

  const words = coverLetterWordCount(draft);
  if (words > 250) {
    violations.push({
      text: "(whole letter)",
      entry_ids: [],
      reason: "too_long",
      detail: `The letter body is ${words} words; it must stay under 250.`,
    });
  }

  return { draft, violations };
}
