import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { getJob, updateJob } from "@/lib/data/queries/jobs";
import { runTask } from "@/lib/intelligence/tasks";
import "@/lib/intelligence/register-tasks";
import "@/lib/intelligence/tasks/eligibility";
import type { EligibilityInput, EligibilityResult } from "@/lib/intelligence/tasks/eligibility";
import { fetchPublicPage, FetchBlockedError } from "@/lib/intelligence/tools/fetch-page";
import { AiUnavailableError, AiValidationError } from "@/lib/intelligence/deepseek";
import {
  TaskNotRegisteredError,
  SpendCapReachedError,
} from "@/lib/intelligence/tasks";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * POST /api/jobs/[id]/eligibility  (Prompt 14)
 * Runs the eligibility_check task BEFORE any tailoring is possible. If a
 * link exists, the server fetches the public page; a failed fetch is noted
 * and the check continues with the pasted text. Code rules after the model:
 * every evidence quote must actually appear in the source text, and no
 * quote at all forces the result to unverified.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const limiter = rateLimit(`eligibility:${user.id}`, 10, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${limiter.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const job = await getJob(supabase, id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (!job.description || job.description.trim().length < 50) {
    return NextResponse.json(
      { error: "Paste the job description first; eligibility reads the posting." },
      { status: 400 },
    );
  }

  let pageText: string | null = null;
  let fetchNote: string | null = null;
  if (job.source_url) {
    try {
      pageText = await fetchPublicPage(job.source_url);
    } catch (err) {
      fetchNote =
        err instanceof FetchBlockedError
          ? err.message
          : "The page could not be fetched; the check used the pasted text only.";
    }
  }

  try {
    const input: EligibilityInput = {
      jobText: job.description,
      pageText,
      link: job.source_url,
    };
    const result = (await runTask({
      name: "eligibility_check",
      input,
      userId: user.id,
      supabase,
      entriesUsed: 0,
    })) as EligibilityResult;

    // Code rule: every quote must exist in the supplied source text; a
    // result with no surviving quote becomes unverified.
    const sourceTexts = [job.description, pageText].filter(
      (t): t is string => Boolean(t),
    );
    const normalise = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
    const sources = sourceTexts.map(normalise);
    const evidence = result.evidence.filter((e) =>
      sources.some((s) => s.includes(normalise(e.quote))),
    );
    let classification = result.classification;
    if (evidence.length === 0) {
      classification = "unverified";
    }
    // Code rule: "remote" alone never means global - an explicit "yes" needs
    // worldwide/South Africa evidence; otherwise downgrade a bare eligible.
    if (classification === "eligible") {
      const explicit = evidence.some((e) =>
        /south africa|worldwide|anywhere|globally|global candidates|international applicants/i.test(
          e.quote,
        ),
      );
      if (!explicit) classification = "potentially_eligible";
    }

    await updateJob(supabase, id, {
      employer_country: result.employer_country || null,
      eligible_countries: result.countries_accepted,
      employment_type: result.truly_remote === "location_restricted" ? job.employment_type ?? "unknown" : job.employment_type,
      engagement_model: result.engagement_model,
      timezone: result.timezone || null,
      required_overlap_hours: result.required_overlap_hours || null,
      salary_currency: result.salary_currency || null,
      salary_min: result.salary_min,
      salary_max: result.salary_max,
      eligibility_status: classification,
      eligibility_evidence: evidence,
      eligibility_checked_at: new Date().toISOString(),
    });

    return NextResponse.json({
      eligibility: { ...result, classification },
      evidence,
      classification,
      fetch_note: fetchNote,
    });
  } catch (err) {
    if (err instanceof TaskNotRegisteredError || err instanceof SpendCapReachedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error(
      "eligibility check failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
