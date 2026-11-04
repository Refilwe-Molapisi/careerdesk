"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, FileText, Loader2 } from "lucide-react";
import type {
  ApplicationDocument,
  CareerEntry,
  Job,
} from "@/lib/data/types";
import type { FitReport } from "@/lib/intelligence/tasks/fit-report";
import {
  cvDraftLines,
  type CoverLetterDraft,
  type CvDraft,
} from "@/lib/intelligence/drafts";
import type { Violation } from "@/lib/intelligence/validate";

type TailorWizardProps = {
  job: Job;
  entries: CareerEntry[];
};

const STATUS_STYLES: Record<string, string> = {
  evidenced: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  partial: "!border-amber-200 !bg-amber-50 !text-amber-800",
  gap: "!border-red-200 !bg-red-50 !text-red-700",
};

export function TailorWizard({ job, entries }: TailorWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<"fit" | "drafting" | "done">("fit");
  const [fitReport, setFitReport] = useState<FitReport | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cvDoc, setCvDoc] = useState<ApplicationDocument | null>(null);
  const [letterDoc, setLetterDoc] = useState<ApplicationDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runFit() {
    setFitLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "fit" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "The fit report failed.");
      const report = body.fit_report as FitReport;
      setFitReport(report);
      setSelectedIds(
        new Set(
          entries
            .filter((e) => report.requirements.some((r) => r.entry_ids.includes(e.id)))
            .map((e) => e.id),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setFitLoading(false);
    }
  }

  function toggleEntry(id: string) {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function draft(kind: "cv" | "cover_letter") {
    const res = await fetch(`/api/jobs/${job.id}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "draft",
        kind,
        allowed_entry_ids: Array.from(selectedIds),
        fit_report: fitReport,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "Drafting failed.");
    return body.document as ApplicationDocument;
  }

  async function runDrafts() {
    setStep("drafting");
    setError(null);
    try {
      const cv = await draft("cv");
      const letter = await draft("cover_letter");
      setCvDoc(cv);
      setLetterDoc(letter);
      setStep("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("fit");
    }
  }

  const violations = [
    ...(((cvDoc?.source_map ?? {}) as { violations?: Violation[] }).violations ?? []),
    ...(((letterDoc?.source_map ?? {}) as { violations?: Violation[] }).violations ?? []),
  ];

  return (
    <div className="space-y-5">
      {step === "fit" ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Step 1: fit report</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                The server reads the posting against your record. Requirements
                it cannot support are listed as gaps and stay out of the CV.
              </p>
            </div>
            <button onClick={runFit} disabled={fitLoading} className="btn-primary">
              <Bot className="h-4 w-4" aria-hidden />
              {fitLoading ? "Reading the posting..." : "Run fit report"}
            </button>
          </div>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}

      {fitReport ? (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-stone-900">Fit report</h2>
          {fitReport.summary ? (
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {fitReport.summary}
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {fitReport.requirements.map((r, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2"
              >
                <span className="min-w-0 text-sm text-stone-800">
                  {r.requirement}
                  {r.note ? (
                    <span className="block text-xs text-stone-400">{r.note}</span>
                  ) : null}
                </span>
                <span className={`chip ${STATUS_STYLES[r.status] ?? ""}`}>
                  {r.status}
                  {r.entry_ids.length > 0 ? ` · ${r.entry_ids.length}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fitReport && step !== "drafting" && step !== "done" ? (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-stone-900">
            Step 2: choose what the AI may use
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Entries cited in the fit report are pre-selected. Untick anything
            you do not want used; the drafts can only cite what you allow.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {entries.map((entry) => (
              <label
                key={entry.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  selectedIds.has(entry.id)
                    ? "border-accent/50 bg-accent-soft/50"
                    : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(entry.id)}
                  onChange={() => toggleEntry(entry.id)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-accent focus:ring-accent"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-900">
                    {entry.title}
                  </span>
                  <span className="block truncate text-xs text-stone-400">
                    {[entry.organisation, entry.type].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button onClick={runFit} className="btn-ghost">
              Re-run fit report
            </button>
            <button
              onClick={runDrafts}
              disabled={selectedIds.size === 0}
              className="btn-primary"
            >
              <Bot className="h-4 w-4" aria-hidden />
              Draft CV and cover letter
            </button>
          </div>
        </section>
      ) : null}

      {step === "drafting" ? (
        <section className="card flex items-center gap-3 p-5 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
          Drafting and claim-checking both documents. This runs two AI calls
          per document and usually takes under a minute.
        </section>
      ) : null}

      {step === "done" && cvDoc && letterDoc ? (
        <>
          {violations.length > 0 ? (
            <section className="card border-amber-200 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                Claim check flagged {violations.length}{" "}
                {violations.length === 1 ? "line" : "lines"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                These lines claim something their cited entries do not support.
                They are kept visible but can never be approved; edit them in
                the review screen.
              </p>
              <ul className="mt-3 space-y-2">
                {violations.map((v, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900"
                  >
                    <span className="font-medium">{v.detail}</span>
                    <span className="block">Line: {v.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Both drafts passed the deterministic claim checks. The AI claim
              check runs again whenever you edit in the review screen.
            </p>
          )}

          <DraftPreview
            title={`CV draft v${cvDoc.version}`}
            document={cvDoc}
          />
          <DraftPreview
            title={`Cover letter draft v${letterDoc.version}`}
            document={letterDoc}
          />

          <div className="flex justify-end gap-2">
            <Link href={`/jobs/${job.id}`} className="btn-outline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to job
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

// Drafting failures return to the fit/select step with the error visible.

type DraftPreviewProps = { title: string; document: ApplicationDocument };

function DraftPreview({ title, document }: DraftPreviewProps) {
  if (document.kind === "cv") {
    const draft = document.content_json as CvDraft;
    return (
      <section className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <FileText className="h-4 w-4 text-stone-400" aria-hidden />
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-stone-700">
          {draft.summary.text}
        </p>
        {draft.skills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {draft.skills.map((s, i) => (
              <span key={i} className="chip">
                {s.text}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {[...draft.experience, ...draft.projects].map((section, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-stone-900">
                {section.heading}
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-stone-600">
                {section.bullets.map((b, j) => (
                  <li key={j}>{b.text}</li>
                ))}
              </ul>
            </div>
          ))}
          {draft.education.map((e, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-stone-900">{e.heading}</p>
              <p className="text-sm text-stone-600">{e.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          {cvDraftLines(draft).length} cited lines. Full editing arrives in the
          review screen.
        </p>
      </section>
    );
  }

  const draft = document.content_json as CoverLetterDraft;
  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <FileText className="h-4 w-4 text-stone-400" aria-hidden />
        {title}
      </h3>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-stone-700">
        <p>{draft.greeting}</p>
        {draft.paragraphs.map((p, i) => (
          <p key={i}>{p.text}</p>
        ))}
        <p>{draft.closing}</p>
      </div>
    </section>
  );
}
