"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Loader2, MailQuestion } from "lucide-react";
import type { Job } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export const ELIGIBILITY_LABELS: Record<Job["eligibility_status"], string> = {
  eligible: "Eligible",
  potentially_eligible: "Potentially eligible",
  ineligible: "Ineligible",
  unverified: "Unverified",
};

export const ELIGIBILITY_CHIP: Record<Job["eligibility_status"], string> = {
  eligible: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  potentially_eligible: "!border-amber-200 !bg-amber-50 !text-amber-800",
  ineligible: "!border-red-200 !bg-red-50 !text-red-700",
  unverified: "!text-stone-400",
};

export function EligibilityBadge({
  status,
  className,
}: {
  status: Job["eligibility_status"] | undefined;
  className?: string;
}) {
  // Rows saved before the eligibility migration have no status; show
  // unverified instead of crashing or rendering an empty chip.
  const resolved = status ?? "unverified";
  return (
    <span className={cn("chip", ELIGIBILITY_CHIP[resolved], className)}>
      <Globe className="h-3 w-3" aria-hidden />
      {ELIGIBILITY_LABELS[resolved]}
    </span>
  );
}

/** The plain note the spec requires beside every eligibility reading. */
export const ELIGIBILITY_DISCLAIMER =
  "Confirm with the employer before applying: this is a reading of the posting, not legal advice.";

export function RunEligibilityButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/jobs/${jobId}/eligibility`, {
            method: "POST",
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok) throw new Error(payload?.error ?? "Check failed.");
          toast.success(
            payload.fetch_note
              ? `Checked with pasted text. ${payload.fetch_note}`
              : "Eligibility checked.",
          );
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Check failed.");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="btn-outline"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Globe className="h-4 w-4" aria-hidden />
      )}
      {busy ? "Reading the posting..." : "Check eligibility"}
    </button>
  );
}

/**
 * Employer questions checklist, generated from what the posting does not
 * answer. Copyable so it can be emailed before applying.
 */
export function EmployerChecklist({ job }: { job: Job }) {
  const [copied, setCopied] = useState(false);

  const questions: string[] = [];
  if (job.engagement_model === "unknown" || !job.engagement_model) {
    questions.push(
      "Would I be engaged through local employment, an Employer of Record, or as a contractor?",
    );
  }
  if (!job.salary_currency) {
    questions.push("In which currency is the salary paid, and what is the range?");
  }
  if (!job.timezone && !job.required_overlap_hours) {
    questions.push("Which time zone does the team work in, and how many hours of overlap do you need?");
  }
  if (job.candidate_location_eligible !== true) {
    questions.push(
      "Do you engage South African residents, and is any local work authorisation or residency required on my side?",
    );
  }
  questions.push("Who provides the equipment, and how is payroll handled across borders?");
  if (questions.length <= 2) return null;

  const text = `Hi,\n\nBefore applying, could you confirm a few points about this role?\n\n${questions.map((q) => `- ${q}`).join("\n")}\n\nThank you!`;

  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
        <MailQuestion className="h-3.5 w-3.5" aria-hidden />
        Questions to email the employer
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-stone-600">
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-2 text-xs font-medium text-accent hover:underline"
      >
        {copied ? "Copied." : "Copy for an email"}
      </button>
    </div>
  );
}
