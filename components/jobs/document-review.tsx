"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  DOCUMENT_TEMPLATES,
  DOCUMENT_TEMPLATE_LABELS,
  type ApplicationDocument,
  type CareerEntry,
  type DocumentTemplate,
} from "@/lib/data/types";
import { createClient } from "@/lib/data/supabase/browser";
import { markJobApplied } from "@/lib/data/queries/jobs";
import {
  coverLetterDraftLines,
  cvDraftLines,
  type CoverLetterDraft,
  type CvDraft,
} from "@/lib/intelligence/drafts";
import type { FitReport } from "@/lib/intelligence/tasks/fit-report";
import type { Violation } from "@/lib/intelligence/validate";
import { partOptions } from "@/lib/operations/document-parts";
import { Modal } from "@/components/ui/modal";

type DocumentReviewProps = {
  jobId: string;
  documents: import("@/lib/data/types").ApplicationDocument[];
  entries: CareerEntry[];
  initialDocumentId: string;
};

type LineDraft = { text: string; entry_ids: string[] };

type EditState =
  | ({ kind: "cv" } & CvDraft)
  | ({ kind: "cover_letter" } & CoverLetterDraft);

export function DocumentReview({
  jobId,
  documents: initialDocuments,
  entries,
  initialDocumentId,
}: DocumentReviewProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState(initialDocumentId);
  const firstDoc = initialDocuments.find((d) => d.id === initialDocumentId) ?? initialDocuments[0];
  const [edit, setEdit] = useState<EditState | null>(() =>
    firstDoc ? initialEdit(firstDoc) : null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [partValue, setPartValue] = useState("");
  const [compareWith, setCompareWith] = useState<string>("");
  const [viewingEntry, setViewingEntry] = useState<CareerEntry | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate | null>(() =>
    (firstDoc?.template as DocumentTemplate) ?? null,
  );

  const entriesById = useMemo(
    () => new Map(entries.map((e) => [e.id, e])),
    [entries],
  );

  const selected = documents.find((d) => d.id === selectedId) ?? documents[0];
  const kind = selected.kind;

  const sameKind = useMemo(
    () =>
      documents
        .filter((d) => d.kind === kind)
        .sort((a, b) => a.version - b.version),
    [documents, kind],
  );

  const violations = useMemo(
    () =>
      (((selected.source_map ?? {}) as { violations?: Violation[] }).violations ??
        []) as Violation[],
    [selected],
  );

  const fitReport = useMemo(
    () =>
      (((selected.source_map ?? {}) as { fit_report?: FitReport }).fit_report ??
        null) as FitReport | null,
    [selected],
  );

  const allowedIds = useMemo(
    () =>
      new Set(
        ((selected.source_map ?? {}) as { allowed_entry_ids?: string[] })
          .allowed_entry_ids ?? [],
      ),
    [selected],
  );

  const allowedEntries = useMemo(
    () => entries.filter((e) => allowedIds.has(e.id)),
    [entries, allowedIds],
  );

  function loadIntoEditor(doc: ApplicationDocument) {
    setEdit(initialEdit(doc));
    setTemplate((doc.template as DocumentTemplate) ?? null);
  }

  function selectDocument(id: string) {
    setSelectedId(id);
    setError(null);
    setCompareWith("");
    const doc = documents.find((d) => d.id === id);
    if (doc) loadIntoEditor(doc);
  }

  async function call(body: Record<string, unknown>) {
    const res = await fetch(`/api/jobs/${jobId}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw Object.assign(new Error(payload?.error ?? "Request failed."), {
        violations: payload?.violations as Violation[] | undefined,
      });
    }
    return payload;
  }

  function adoptDocument(doc: ApplicationDocument) {
    setDocuments((docs) => [...docs.filter((d) => d.id !== doc.id), doc]);
    setSelectedId(doc.id);
    const content = doc.content_json;
    setEdit(
      doc.kind === "cv"
        ? { kind: "cv", ...(structuredClone(content as CvDraft)) }
        : { kind: "cover_letter", ...(structuredClone(content as CoverLetterDraft)) },
    );
    setTemplate((doc.template as DocumentTemplate) ?? null);
    router.refresh();
  }

  async function askForChanges() {
    if (!edit || !instruction.trim() || !partValue) return;
    setBusy("revise");
    setError(null);
    try {
      const payload = await call({
        step: "revise",
        document_id: selected.id,
        instruction,
        part: partFromValue(partValue),
      });
      adoptDocument(payload.document as ApplicationDocument);
      setInstruction("");
      toast.success("Revision saved as a new version.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revision failed.");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdits() {
    if (!edit) return;
    setBusy("save");
    setError(null);
    try {
      const payload = await call({
        step: "save_manual",
        document_id: selected.id,
        content_json: stripKind(edit),
      });
      adoptDocument(payload.document as ApplicationDocument);
      toast.success("Edits saved as a new version.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function runClaimCheck() {
    setBusy("check");
    setError(null);
    try {
      const payload = await call({
        step: "claim_check",
        document_id: selected.id,
      });
      setDocuments((docs) =>
        docs.map((d) =>
          d.id === selected.id
            ? {
                ...d,
                source_map: {
                  ...((d.source_map ?? {}) as Record<string, unknown>),
                  violations: payload.violations as Violation[],
                },
              }
            : d,
        ),
      );
      toast.success(
        (payload.violations as Violation[]).length === 0
          ? "No flagged lines."
          : "Check finished; flagged lines updated.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed.");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      await call({ step: "approve", document_id: selected.id });
      setDocuments((docs) =>
        docs.map((d) =>
          d.id === selected.id
            ? { ...d, status: "approved" as const, approved_at: new Date().toISOString() }
            : d,
        ),
      );
      toast.success(
        kind === "cv"
          ? "CV approved. The job moved to Ready."
          : "Cover letter approved.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
    } finally {
      setBusy(null);
    }
  }

  async function newVersionFromApproved() {
    setBusy("fork");
    setError(null);
    try {
      const payload = await call({
        step: "save_manual",
        document_id: selected.id,
        content_json: selected.content_json,
      });
      adoptDocument(payload.document as ApplicationDocument);
      toast.success("New draft version created from the approved one.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a copy.");
    } finally {
      setBusy(null);
    }
  }

  async function changeTemplate(next: DocumentTemplate) {
    setTemplate(next);
    setBusy("template");
    setError(null);
    try {
      const res = await fetch(`/api/documents/${selected.id}/template`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: next }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not save the template.");
      }
      setDocuments((docs) =>
        docs.map((d) => (d.id === selected.id ? { ...d, template: next } : d)),
      );
      toast.success("Template saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the template.");
    } finally {
      setBusy(null);
    }
  }

  const compareDoc = compareWith
    ? documents.find((d) => d.id === compareWith)
    : null;

  const editable = selected.status === "draft";
  const options = edit ? partOptions(kind, edit) : [];

  return (
    <div className="space-y-4">
      {/* Kind tabs + version list */}
      <div className="flex flex-wrap items-center gap-2">
        {(["cv", "cover_letter"] as const).map((k) => {
          const has = documents.some((d) => d.kind === k);
          if (!has) return null;
          const active = kind === k;
          const latest = documents
            .filter((d) => d.kind === k)
            .sort((a, b) => b.version - a.version)[0];
          return (
            <button
              key={k}
              onClick={() => selectDocument(latest.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent-soft text-accent"
                  : "bg-stone-100 text-stone-500 hover:text-stone-800"
              }`}
            >
              {k === "cv" ? "CV" : "Cover letter"}
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-stone-200" aria-hidden />
        {sameKind.map((doc) => (
          <button
            key={doc.id}
            onClick={() => selectDocument(doc.id)}
            className={`chip transition-colors ${
              doc.id === selected.id
                ? "border-accent bg-accent-soft text-accent"
                : doc.status === "approved"
                  ? "!border-emerald-200 !bg-emerald-50 !text-emerald-700"
                  : "hover:border-stone-300"
            }`}
          >
            v{doc.version}
            {doc.status !== "draft" ? ` · ${doc.status}` : ""}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-500">
          <GitCompare className="h-3.5 w-3.5" aria-hidden />
          Compare with
          <select
            value={compareWith}
            onChange={(e) => setCompareWith(e.target.value)}
            className="rounded-md border border-stone-200 px-1.5 py-1 text-xs"
          >
            <option value="">none</option>
            {sameKind
              .filter((d) => d.id !== selected.id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  v{d.version}
                </option>
              ))}
          </select>
        </label>
      </div>

      {selected.status !== "draft" ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          This version is {selected.status} and cannot be edited. Create a new
          version from it to make changes.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {/* Template picker (used by the PDF export) */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs font-medium text-stone-500">
          PDF template:
        </span>
        {DOCUMENT_TEMPLATES.map((t) => (
          <button
            key={t}
            onClick={() => editable && void changeTemplate(t)}
            disabled={!editable || busy === "template"}
            aria-pressed={template === t}
            className={`chip transition-colors ${
              template === t
                ? "border-accent bg-accent-soft text-accent"
                : "hover:border-stone-300"
            } ${!editable ? "opacity-70" : ""}`}
          >
            {DOCUMENT_TEMPLATE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className={compareDoc ? "grid gap-4 xl:grid-cols-2" : ""}>
        {/* Editor / viewer */}
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            {edit?.kind === "cv" ? (
              <CvEditor
                edit={edit}
                editable={editable}
                allowedEntries={allowedEntries}
                entriesById={entriesById}
                onChange={setEdit}
                onViewEntry={setViewingEntry}
              />
            ) : edit?.kind === "cover_letter" ? (
              <LetterEditor
                edit={edit}
                editable={editable}
                allowedEntries={allowedEntries}
                onChange={setEdit}
              />
            ) : null}

            {editable ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-3">
                <button onClick={saveEdits} disabled={busy !== null} className="btn-outline">
                  {busy === "save" ? "Saving..." : "Save my edits (new version)"}
                </button>
              </div>
            ) : (
              <div className="flex justify-end border-t border-stone-100 pt-3">
                <button
                  onClick={newVersionFromApproved}
                  disabled={busy !== null}
                  className="btn-outline"
                >
                  {busy === "fork" ? "Creating..." : "New version from this one"}
                </button>
              </div>
            )}
          </div>

          {/* Ask for changes */}
          {editable ? (
            <div className="card space-y-3 p-5">
              <h3 className="text-sm font-semibold text-stone-900">
                Ask for changes
              </h3>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,180px)_1fr]">
                <select
                  value={partValue}
                  onChange={(e) => setPartValue(e.target.value)}
                  className="input"
                  aria-label="Part to revise"
                >
                  <option value="">Pick a part...</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="input"
                  placeholder='e.g. "shorten the summary" or "lead with the SQL project"'
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={askForChanges}
                  disabled={busy !== null || !partValue || !instruction.trim()}
                  className="btn-primary"
                >
                  {busy === "revise" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Revising...
                    </>
                  ) : (
                    "Regenerate this part"
                  )}
                </button>
              </div>
              <p className="text-xs text-stone-400">
                The server rewrites only the chosen part and re-runs every
                check. The result is saved as a new version.
              </p>
            </div>
          ) : null}
        </div>

        {/* Right column: checks + fit report */}
        <div className="space-y-4">
          <div className="card space-y-3 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
              Claim check
            </h3>
            {editable ? (
              <button
                onClick={runClaimCheck}
                disabled={busy !== null}
                className="btn-outline w-full"
              >
                {busy === "check" ? "Checking..." : "Run claim check again"}
              </button>
            ) : null}
            {violations.length === 0 ? (
              <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                No flagged lines.
              </p>
            ) : (
              <ul className="space-y-2">
                {violations.map((v, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"
                  >
                    <span className="font-medium">{v.detail}</span>
                    <span className="block italic">Line: {v.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {selected.status === "draft" ? (
              <button
                onClick={approve}
                disabled={busy !== null || violations.length > 0}
                className="btn-primary w-full"
              >
                {busy === "approve"
                  ? "Approving..."
                  : violations.length > 0
                    ? "Fix flagged lines to approve"
                    : "Approve this version"}
              </button>
            ) : null}
            {selected.status === "draft" && violations.length > 0 ? (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-stone-500">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                A line that still fails never becomes approved text or part of
                the PDF.
              </p>
            ) : null}
          </div>

          {fitReport ? (
            <div className="card space-y-2 p-5">
              <h3 className="text-sm font-semibold text-stone-900">Fit report</h3>
              {fitReport.summary ? (
                <p className="text-xs leading-relaxed text-stone-500">
                  {fitReport.summary}
                </p>
              ) : null}
              <ul className="space-y-1.5">
                {fitReport.requirements.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-stone-700">
                      {r.requirement}
                    </span>
                    <span
                      className={
                        r.status === "evidenced"
                          ? "chip !border-emerald-200 !bg-emerald-50 !text-emerald-700"
                          : r.status === "partial"
                            ? "chip !border-amber-200 !bg-amber-50 !text-amber-800"
                            : "chip !border-red-200 !bg-red-50 !text-red-700"
                      }
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Compare pane */}
        {compareDoc ? (
          <div className="card space-y-3 p-5">
            <h3 className="text-sm font-semibold text-stone-900">
              Comparing with v{compareDoc.version}
            </h3>
            <div className="rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
              {compareDoc.kind === "cv"
                ? cvDraftLines(compareDoc.content_json as CvDraft).map((l, i) => (
                    <p key={i}>{l.text}</p>
                  ))
                : coverLetterDraftLines(compareDoc.content_json as CoverLetterDraft).map(
                    (l, i) => <p key={i}>{l.text}</p>,
                  )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Export and application recording */}
      <ExportPanel
        jobId={jobId}
        documents={documents}
        selected={selected}
        onExported={(updates) =>
          setDocuments((docs) =>
            docs.map((d) =>
              updates.find((u) => u.id === d.id)
                ? { ...d, ...updates.find((u) => u.id === d.id)! }
                : d,
            ),
          )
        }
        busy={busy}
        setBusy={setBusy}
        onError={setError}
      />

      {/* Entry viewer */}
      <Modal
        open={viewingEntry !== null}
        onClose={() => setViewingEntry(null)}
        title={viewingEntry?.title ?? ""}
      >
        {viewingEntry ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-stone-400">
              {[viewingEntry.organisation, viewingEntry.start_date, viewingEntry.end_date]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {viewingEntry.description ? (
              <p className="leading-relaxed text-stone-700">
                {viewingEntry.description}
              </p>
            ) : null}
            {viewingEntry.evidence ? (
              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                  Evidence
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-600">
                  {viewingEntry.evidence}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function partFromValue(value: string): Record<string, unknown> {
  const [type, indexRaw] = value.split(":");
  const index = indexRaw !== undefined ? Number(indexRaw) : undefined;
  return index !== undefined && !Number.isNaN(index) ? { type, index } : { type };
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

type EditorProps = {
  editable: boolean;
  allowedEntries: CareerEntry[];
  entriesById: Map<string, CareerEntry>;
  onChange: (edit: EditState) => void;
  onViewEntry: (entry: CareerEntry) => void;
};

function SourceChip({
  ids,
  entriesById,
  onViewEntry,
}: {
  ids: string[];
  entriesById: Map<string, CareerEntry>;
  onViewEntry: EditorProps["onViewEntry"];
}) {
  if (ids.length === 0) {
    return <span className="chip !border-red-200 !bg-red-50 !text-red-700">no source</span>;
  }
  return (
    <>
      {ids.map((id) => {
        const entry = entriesById.get(id);
        return (
          <button
            key={id}
            onClick={() => entry && onViewEntry(entry)}
            className="chip hover:border-accent hover:text-accent"
            title={entry ? "Click to view this entry" : id}
          >
            {entry ? entry.title : "missing entry"}
          </button>
        );
      })}
    </>
  );
}

function LineRow({
  line,
  editable,
  allowedEntries,
  entriesById,
  onViewEntry,
  onChange,
  onDelete,
}: {
  line: LineDraft;
  editable: boolean;
  allowedEntries: CareerEntry[];
  entriesById: Map<string, CareerEntry>;
  onViewEntry: EditorProps["onViewEntry"];
  onChange: (next: LineDraft) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {editable ? (
        <textarea
          rows={2}
          value={line.text}
          onChange={(e) => onChange({ ...line, text: e.target.value })}
          className="input flex-1 text-sm"
        />
      ) : (
        <p className="flex-1 text-sm leading-relaxed text-stone-700">{line.text}</p>
      )}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {editable && allowedEntries.length > 0 ? (
          <select
            value={line.entry_ids[0] ?? ""}
            onChange={(e) => onChange({ ...line, entry_ids: [e.target.value] })}
            className="max-w-36 rounded-md border border-stone-200 px-1.5 py-1 text-[11px]"
            aria-label="Source entry"
          >
            <option value="">no source</option>
            {allowedEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        ) : null}
        {editable && onDelete ? (
          <button
            onClick={onDelete}
            className="rounded-lg p-1 text-stone-300 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove this line"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {!editable ? (
          <div className="flex flex-wrap gap-1">
            <SourceChip ids={line.entry_ids} entriesById={entriesById} onViewEntry={onViewEntry} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CvEditor({
  edit,
  editable,
  allowedEntries,
  entriesById,
  onChange,
  onViewEntry,
}: {
  edit: CvDraft & { kind: "cv" };
  editable: boolean;
  allowedEntries: CareerEntry[];
  entriesById: Map<string, CareerEntry>;
  onChange: (edit: EditState) => void;
  onViewEntry: EditorProps["onViewEntry"];
}) {
  function update(patch: Partial<CvDraft>) {
    onChange({ ...edit, ...patch });
  }

  return (
    <div className="space-y-5">
      <section>
        <h4 className="label">Summary</h4>
        <LineRow
          line={edit.summary}
          editable={editable}
          allowedEntries={allowedEntries}
          entriesById={entriesById}
          onViewEntry={onViewEntry}
          onChange={(summary) => update({ summary })}
        />
      </section>

      <section>
        <h4 className="label">Skills</h4>
        <div className="space-y-2">
          {edit.skills.map((line, i) => (
            <LineRow
              key={i}
              line={line}
              editable={editable}
              allowedEntries={allowedEntries}
              entriesById={entriesById}
              onViewEntry={onViewEntry}
              onChange={(next) =>
                update({ skills: edit.skills.map((s, j) => (j === i ? next : s)) })
              }
              onDelete={
                editable
                  ? () => update({ skills: edit.skills.filter((_, j) => j !== i) })
                  : undefined
              }
            />
          ))}
          {editable ? (
            <AddLineButton
              allowedEntries={allowedEntries}
              onAdd={(line) => update({ skills: [...edit.skills, line] })}
            />
          ) : null}
        </div>
      </section>

      {(["experience", "projects"] as const).map((key) => (
        <section key={key}>
          <h4 className="label">{key === "experience" ? "Experience" : "Projects"}</h4>
          <div className="space-y-4">
            {edit[key].map((section, si) => (
              <div key={si} className="rounded-lg border border-stone-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  {editable ? (
                    <input
                      value={section.heading}
                      onChange={(e) =>
                        update({
                          [key]: edit[key].map((s, j) =>
                            j === si ? { ...s, heading: e.target.value } : s,
                          ),
                        })
                      }
                      className="input flex-1 text-sm font-semibold"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-stone-900">
                      {section.heading}
                    </p>
                  )}
                  <SourceChip
                    ids={[section.entry_id]}
                    entriesById={entriesById}
                    onViewEntry={onViewEntry}
                  />
                </div>
                <div className="space-y-2">
                  {section.bullets.map((line, bi) => (
                    <LineRow
                      key={bi}
                      line={line}
                      editable={editable}
                      allowedEntries={allowedEntries}
                      entriesById={entriesById}
                      onViewEntry={onViewEntry}
                      onChange={(next) =>
                        update({
                          [key]: edit[key].map((s, j) =>
                            j === si
                              ? {
                                  ...s,
                                  bullets: s.bullets.map((b, bj) =>
                                    bj === bi ? next : b,
                                  ),
                                }
                              : s,
                          ),
                        })
                      }
                      onDelete={
                        editable
                          ? () =>
                              update({
                                [key]: edit[key].map((s, j) =>
                                  j === si
                                    ? {
                                        ...s,
                                        bullets: s.bullets.filter(
                                          (_, bj) => bj !== bi,
                                        ),
                                      }
                                    : s,
                                ),
                              })
                          : undefined
                      }
                    />
                  ))}
                  {editable ? (
                    <AddLineButton
                      allowedEntries={allowedEntries}
                      defaultEntryId={section.entry_id}
                      onAdd={(line) =>
                        update({
                          [key]: edit[key].map((s, j) =>
                            j === si ? { ...s, bullets: [...s.bullets, line] } : s,
                          ),
                        })
                      }
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h4 className="label">Education</h4>
        <div className="space-y-3">
          {edit.education.map((item, i) => (
            <div key={i} className="rounded-lg border border-stone-100 p-3">
              <div className="flex items-center justify-between gap-2">
                {editable ? (
                  <input
                    value={item.heading}
                    onChange={(e) =>
                      update({
                        education: edit.education.map((s, j) =>
                          j === i ? { ...s, heading: e.target.value } : s,
                        ),
                      })
                    }
                    className="input flex-1 text-sm font-semibold"
                  />
                ) : (
                  <p className="text-sm font-semibold text-stone-900">{item.heading}</p>
                )}
                <SourceChip
                  ids={[item.entry_id]}
                  entriesById={entriesById}
                  onViewEntry={onViewEntry}
                />
              </div>
              <div className="mt-2">
                <LineRow
                  line={{ text: item.detail, entry_ids: [item.entry_id] }}
                  editable={editable}
                  allowedEntries={allowedEntries}
                  entriesById={entriesById}
                  onViewEntry={onViewEntry}
                  onChange={(next) =>
                    update({
                      education: edit.education.map((s, j) =>
                        j === i ? { ...s, detail: next.text } : s,
                      ),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LetterEditor({
  edit,
  editable,
  allowedEntries,
  onChange,
}: {
  edit: CoverLetterDraft & { kind: "cover_letter" };
  editable: boolean;
  allowedEntries: CareerEntry[];
  onChange: (edit: EditState) => void;
}) {
  function update(patch: Partial<CoverLetterDraft>) {
    onChange({ ...edit, ...patch });
  }

  return (
    <div className="space-y-4">
      {editable ? (
        <input
          value={edit.greeting}
          onChange={(e) => update({ greeting: e.target.value })}
          className="input text-sm font-medium"
          aria-label="Greeting"
        />
      ) : (
        <p className="text-sm font-medium text-stone-800">{edit.greeting}</p>
      )}

      <div className="space-y-3">
        {edit.paragraphs.map((line, i) => (
          <div key={i} className="flex items-start gap-2">
            {editable ? (
              <textarea
                rows={4}
                value={line.text}
                onChange={(e) =>
                  update({
                    paragraphs: edit.paragraphs.map((p, j) =>
                      j === i ? { ...p, text: e.target.value } : p,
                    ),
                  })
                }
                className="input flex-1 text-sm leading-relaxed"
              />
            ) : (
              <p className="flex-1 text-sm leading-relaxed text-stone-700">
                {line.text}
              </p>
            )}
            <div className="flex w-36 shrink-0 flex-col gap-1">
              {editable && allowedEntries.length > 0 ? (
                <select
                  value={line.entry_ids[0] ?? ""}
                  onChange={(e) =>
                    update({
                      paragraphs: edit.paragraphs.map((p, j) =>
                        j === i ? { ...p, entry_ids: [e.target.value] } : p,
                      ),
                    })
                  }
                  className="rounded-md border border-stone-200 px-1.5 py-1 text-[11px]"
                  aria-label="Source entry"
                >
                  <option value="">no source</option>
                  {allowedEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
              ) : null}
              {editable ? (
                <button
                  onClick={() =>
                    update({
                      paragraphs: edit.paragraphs.filter((_, j) => j !== i),
                    })
                  }
                  className="rounded-lg p-1 text-stone-300 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove this paragraph"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {editable && allowedEntries.length > 0 ? (
          <button
            onClick={() =>
              update({
                paragraphs: [
                  ...edit.paragraphs,
                  { text: "", entry_ids: [allowedEntries[0].id] },
                ],
              })
            }
            className="btn-ghost text-xs"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add paragraph
          </button>
        ) : null}
      </div>

      {editable ? (
        <input
          value={edit.closing}
          onChange={(e) => update({ closing: e.target.value })}
          className="input text-sm font-medium"
          aria-label="Closing"
        />
      ) : (
        <p className="text-sm font-medium text-stone-800">{edit.closing}</p>
      )}
    </div>
  );
}

function AddLineButton({
  allowedEntries,
  defaultEntryId,
  onAdd,
}: {
  allowedEntries: CareerEntry[];
  defaultEntryId?: string;
  onAdd: (line: LineDraft) => void;
}) {
  return (
    <button
      onClick={() =>
        onAdd({
          text: "",
          entry_ids: [
            defaultEntryId && allowedEntries.some((e) => e.id === defaultEntryId)
              ? defaultEntryId
              : (allowedEntries[0]?.id ?? ""),
          ],
        })
      }
      className="btn-ghost text-xs"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden /> Add line
    </button>
  );
}

function stripKind(edit: EditState): unknown {
  const { kind: _kind, ...content } = edit;
  void _kind;
  return content;
}

function initialEdit(doc: ApplicationDocument): EditState {
  const content = structuredClone(doc.content_json);
  return doc.kind === "cv"
    ? { kind: "cv", ...(content as CvDraft) }
    : { kind: "cover_letter", ...(content as CoverLetterDraft) };
}

/**
 * Export, download and the document-verified "mark as applied" (Prompt 8).
 * The apply action only enables when an approved CV and an approved cover
 * letter both have an exported PDF; the RPC re-verifies all of it.
 */
function ExportPanel({
  jobId,
  documents,
  selected,
  onExported,
  busy,
  setBusy,
  onError,
}: {
  jobId: string;
  documents: ApplicationDocument[];
  selected: ApplicationDocument;
  onExported: (
    updates: { id: string; pdf_path: string; pdf_sha256: string }[],
  ) => void;
  busy: string | null;
  setBusy: (value: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();

  const latestApprovedWithPdf = (kind: "cv" | "cover_letter") =>
    documents
      .filter(
        (d) =>
          d.kind === kind &&
          d.status === "approved" &&
          typeof d.pdf_path === "string" &&
          d.pdf_path !== "",
      )
      .sort((a, b) => b.version - a.version)[0] ?? null;

  const approvedCv = latestApprovedWithPdf("cv");
  const approvedLetter = latestApprovedWithPdf("cover_letter");
  const canRecordApplication = Boolean(approvedCv && approvedLetter);

  async function exportPdf() {
    setBusy("export");
    onError(null);
    try {
      const res = await fetch(`/api/documents/${selected.id}/export`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Export failed.");
      }
      onExported([
        {
          id: selected.id,
          pdf_path: payload.pdf_path as string,
          pdf_sha256: payload.pdf_sha256 as string,
        },
      ]);
      toast.success("PDF saved to your private storage.");
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  function download() {
    window.open(`/api/documents/${selected.id}/download`, "_blank");
  }

  async function recordApplication() {
    if (!approvedCv || !approvedLetter) return;
    setBusy("apply");
    onError(null);
    try {
      // The server-side RPC re-verifies both documents: owner, approved,
      // exported. It copies the exact paths and hashes into the application.
      await markJobApplied(
        createClient(),
        jobId,
        approvedCv.id,
        approvedLetter.id,
      );
      toast.success("Recorded as applied, with both document hashes.");
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not record it.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h3 className="text-sm font-semibold text-stone-900">
        Export and record the application
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportPdf}
          disabled={busy !== null}
          className="btn-primary"
        >
          {busy === "export" ? "Exporting..." : "Export PDF"}
        </button>
        {selected.pdf_path ? (
          <button onClick={download} className="btn-outline">
            Download PDF
          </button>
        ) : (
          <span className="text-xs text-stone-400">
            Not exported yet. Export before approving so the exact file that
            was sent is recorded by hash.
          </span>
        )}
        {selected.pdf_sha256 ? (
          <span
            className="chip max-w-48 truncate"
            title={`SHA-256: ${selected.pdf_sha256}`}
          >
            sha256: {selected.pdf_sha256.slice(0, 12)}...
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-xs leading-relaxed text-stone-600">
        {canRecordApplication ? (
          <>
            <p>
              CV v{approvedCv!.version} and cover letter v
              {approvedLetter!.version} are approved and exported.
            </p>
            <button
              onClick={recordApplication}
              disabled={busy !== null}
              className="btn-primary mt-2"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {busy === "apply" ? "Recording..." : "Mark as applied with these documents"}
            </button>
            <p className="mt-1.5 text-stone-400">
              You still submit them to the employer yourself; this only records
              what was sent, by file hash.
            </p>
          </>
        ) : (
          <p>
            To record an application with its documents, approve and export
            both a CV and a cover letter for this job. Approved versions with
            an exported PDF unlock the button above. You can also record a
            manual application from the job page without documents.
          </p>
        )}
      </div>
    </section>
  );
}
