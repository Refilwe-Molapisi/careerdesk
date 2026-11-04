"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, CalendarClock, FileText } from "lucide-react";
import { RecommendationCard } from "@/components/jobs/recommendation-card";
import { createClient } from "@/lib/data/supabase/browser";
import { markJobApplied, updateJob } from "@/lib/data/queries/jobs";
import {
  ELIGIBILITY_DISCLAIMER,
  EligibilityBadge,
  EmployerChecklist,
  RunEligibilityButton,
} from "@/components/jobs/eligibility";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  ROLE_FAMILY_LABELS,
  TARGET_ROLE_FAMILIES,
  WORK_MODE_LABELS,
  type ApplicationDocument,
  type Job,
  type JobStatus,
  type StatusHistoryEntry,
} from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils";

type JobDetailClientProps = {
  job: Job;
  history: StatusHistoryEntry[];
  applied: boolean;
  documents: ApplicationDocument[];
};

export function JobDetailClient({
  job,
  history,
  applied,
  documents,
}: JobDetailClientProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(job.notes ?? "");
  const [followUp, setFollowUp] = useState(job.follow_up_date ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function changeStatus(status: JobStatus) {
    if (status === job.status) return;
    setBusy("status");
    try {
      await updateJob(createClient(), job.id, { status });
      toast.success(`Status changed to ${JOB_STATUS_LABELS[status]}.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes() {
    setBusy("notes");
    try {
      await updateJob(createClient(), job.id, { notes: notes.trim() || null });
      toast.success("Notes saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notes.");
    } finally {
      setBusy(null);
    }
  }

  async function saveFollowUp() {
    setBusy("followup");
    try {
      await updateJob(createClient(), job.id, {
        follow_up_date: followUp || null,
      });
      toast.success(followUp ? "Follow-up date saved." : "Follow-up cleared.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the date.");
    } finally {
      setBusy(null);
    }
  }

  async function markApplied() {
    setBusy("applied");
    try {
      // Atomic RPC: job status -> applied (history written by the trigger)
      // and the applications row created. The app never applies for you.
      await markJobApplied(createClient(), job.id);
      toast.success("Recorded as applied. You submitted it yourself.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record it.");
    } finally {
      setBusy(null);
    }
  }

  const offTarget = !TARGET_ROLE_FAMILIES.includes(job.role_family);
  const canMarkApplied = !applied && !["applied", "interviewing", "offer"].includes(job.status);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-stone-900">
              {job.title ?? "Untitled role"}
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {[job.company, job.location, job.work_mode ? WORK_MODE_LABELS[job.work_mode] : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip">{ROLE_FAMILY_LABELS[job.role_family]}</span>
              {offTarget ? (
                <span className="chip !border-amber-200 !bg-amber-50 !text-amber-800">
                  off-target
                </span>
              ) : null}
              {job.seniority ? <span className="chip">{job.seniority}</span> : null}
              {job.closing_date ? (
                <span className="chip">closes {job.closing_date}</span>
              ) : null}
              <EligibilityBadge status={job.eligibility_status} />
            </div>
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="detail-status" className="label">
              Status
            </label>
            <select
              id="detail-status"
              value={job.status}
              disabled={busy === "status"}
              onChange={(e) => changeStatus(e.target.value as JobStatus)}
              className="input"
            >
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {job.role_family_reason ? (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
            <span className="font-medium text-stone-600">Why this family:</span>{" "}
            {job.role_family_reason}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {canMarkApplied ? (
            <button onClick={markApplied} disabled={busy === "applied"} className="btn-primary">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {busy === "applied" ? "Recording..." : "Mark as applied"}
            </button>
          ) : null}
          <div>
            <label htmlFor="detail-followup" className="label !mb-1 text-xs">
              Follow-up date
            </label>
            <div className="flex items-center gap-2">
              <input
                id="detail-followup"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="input !w-auto"
              />
              <button
                onClick={saveFollowUp}
                disabled={busy === "followup"}
                className="btn-outline"
              >
                <CalendarClock className="h-4 w-4" aria-hidden />
                Save
              </button>
            </div>
          </div>
        </div>

        {applied ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Recorded as applied (submitted by you, manually).
          </p>
        ) : (
          <p className="mt-3 text-xs text-stone-400">
            The app never submits applications for you. When you have applied
            yourself, press Mark as applied to record the date.
          </p>
        )}
      </section>

      {/* Description */}
      {job.description ? (
        <section className="card p-5">
          <h3 className="mb-2 text-sm font-semibold text-stone-900">
            Description
          </h3>
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
            {job.description}
          </div>
          {job.source_url ? (
            <p className="mt-3 break-all text-xs text-stone-400">
              Source:{" "}
              <a
                href={job.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline hover:text-stone-600"
              >
                {job.source_url}
              </a>{" "}
              (stored only, never fetched by the app)
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Skills */}
      {job.required_skills.length > 0 || job.preferred_skills.length > 0 ? (
        <section className="card space-y-3 p-5">
          <h3 className="text-sm font-semibold text-stone-900">
            Extracted skills
          </h3>
          {job.required_skills.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
                Required
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.required_skills.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {job.preferred_skills.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
                Preferred
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.preferred_skills.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Application instructions */}
      {job.application_instructions ? (
        <section className="card p-5">
          <h3 className="mb-2 text-sm font-semibold text-stone-900">
            Application instructions
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
            {job.application_instructions}
          </p>
        </section>
      ) : null}

      <RecommendationCard job={job} />

      {/* Documents */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <FileText className="h-4 w-4 text-stone-400" aria-hidden />
            CV and cover letter versions
          </h3>
          {job.description && job.description.trim().length >= 50 ? (
            <div className="flex flex-wrap items-center gap-2">
              <RunEligibilityButton jobId={job.id} />
              {job.eligibility_status === "ineligible" ? (
                <span className="text-xs text-red-600">
                  Ineligible: tailor anyway only with a reason.
                </span>
              ) : null}
              <Link
                href={`/jobs/${job.id}/tailor`}
                className="btn-outline !border-accent/40 !text-accent hover:!bg-accent-soft"
              >
                {documents.some((d) => d.status === "draft")
                  ? "Continue tailoring"
                  : job.eligibility_status === "ineligible"
                    ? "Tailor anyway"
                    : "Tailor my application"}
              </Link>
            </div>
          ) : null}
        </div>
        {(job.eligibility_evidence ?? []).length > 0 ? (
          <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-stone-700">
              Eligibility evidence from the posting
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {(job.eligibility_evidence ?? []).map((item, i) => (
                <li key={i} className="text-xs leading-relaxed text-stone-600">
                  <span className="italic">&ldquo;{item.quote}&rdquo;</span>
                  {item.note ? <span className="text-stone-400"> — {item.note}</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-stone-400">{ELIGIBILITY_DISCLAIMER}</p>
          </div>
        ) : null}
        <EmployerChecklist job={job} />
        {documents.length === 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-stone-400">
            None yet. Tailoring drafts a CV and cover letter from your Career
            Record, checks every line against it, and saves versions here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/jobs/${job.id}/review?doc=${doc.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2 hover:border-accent/40"
                >
                  <span className="text-sm font-medium text-stone-800">
                    {doc.kind === "cv" ? "CV" : "Cover letter"} v{doc.version}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={
                        doc.status === "approved"
                          ? "chip !border-emerald-200 !bg-emerald-50 !text-emerald-700"
                          : doc.status === "superseded"
                            ? "chip !text-stone-400"
                            : "chip"
                      }
                    >
                      {doc.status}
                    </span>
                    <span className="text-xs text-stone-400">
                      {formatDateTime(doc.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section className="card p-5">
        <label htmlFor="job-notes" className="label">
          My notes
        </label>
        <textarea
          id="job-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input"
          placeholder="Anything worth remembering: contacts, thoughts, salary hints."
        />
        <div className="mt-2 flex justify-end">
          <button onClick={saveNotes} disabled={busy === "notes"} className="btn-outline">
            {busy === "notes" ? "Saving..." : "Save notes"}
          </button>
        </div>
      </section>

      {/* Status history timeline */}
      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-stone-900">
          Status history
        </h3>
        <ol className="space-y-0">
          {history.map((entry, i) => (
            <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
              <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent/30" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-stone-800">
                  {entry.from_status === null ? (
                    <>Saved as <span className="font-medium">{JOB_STATUS_LABELS[entry.to_status]}</span></>
                  ) : (
                    <>
                      <span className="font-medium">{JOB_STATUS_LABELS[entry.from_status]}</span>
                      {" → "}
                      <span className="font-medium">{JOB_STATUS_LABELS[entry.to_status]}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-stone-400">
                  {formatDateTime(entry.changed_at)}
                  {i === 0 ? " · latest" : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
