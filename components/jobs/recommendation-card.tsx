"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Scale } from "lucide-react";
import type { Job } from "@/lib/data/types";
import {
  RECOMMENDATION_LABELS,
  type RecommendationFactor,
} from "@/lib/operations/prioritise";

const REC_CHIP: Record<string, string> = {
  apply: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  apply_with_reservations: "!border-amber-200 !bg-amber-50 !text-amber-800",
  develop_first: "!border-sky-200 !bg-sky-50 !text-sky-800",
  do_not_apply: "!border-red-200 !bg-red-50 !text-red-700",
};

export function RecommendationCard({ job }: { job: Job }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [overrideValue, setOverrideValue] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");

  const factors = (job.recommendation_factors ?? []) as RecommendationFactor[];
  const hasRecommendation = job.recommendation != null;

  async function compute() {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/recommendation`, { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Could not compute.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not compute.");
    } finally {
      setBusy(false);
    }
  }

  async function override() {
    if (!overrideValue) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/recommendation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation: overrideValue, reason: overrideReason }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Could not save.");
      toast.success("Override saved with your reason.");
      setOverriding(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Scale className="h-4 w-4 text-accent" aria-hidden />
          Recommendation
        </h3>
        {job.recommendation ? (
          <span className={`chip ${REC_CHIP[job.recommendation] ?? ""}`}>
            {RECOMMENDATION_LABELS[job.recommendation]}
            {job.recommendation_overridden ? " · overridden" : ""}
          </span>
        ) : null}
      </div>

      {!hasRecommendation ? (
        <>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
            Rules in code read eligibility, your skills, experience,
            qualifications, salary floor and career direction - no single
            score. The AI only explains what the rules decided.
          </p>
          <button onClick={compute} disabled={busy} className="btn-outline mt-3">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {busy ? "Computing..." : "Compute recommendation"}
          </button>
        </>
      ) : (
        <>
          <table className="mt-3 w-full text-left text-xs">
            <tbody>
              {factors.map((f, i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 pr-2 font-medium text-stone-600">{f.factor}</td>
                  <td className="py-1.5 pr-2 text-stone-800">{f.value}</td>
                  <td className="py-1.5 text-stone-400">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {job.recommendation_note ? (
            <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
              {job.recommendation_note}
            </p>
          ) : null}
          {job.recommendation_overridden && job.override_reason ? (
            <p className="mt-2 text-xs text-amber-800">
              Your override: {job.override_reason}
            </p>
          ) : null}
          {!overriding ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {!job.recommendation_overridden ? (
                <button onClick={() => setOverriding(true)} className="btn-ghost text-xs">
                  Override
                </button>
              ) : null}
              <button onClick={compute} disabled={busy} className="btn-ghost text-xs">
                {busy ? "Recomputing..." : "Recompute"}
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2 rounded-lg bg-stone-50 px-3 py-2.5">
              <select
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                className="input"
                aria-label="Override recommendation"
              >
                <option value="">Pick a recommendation...</option>
                {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="input"
                placeholder="Why? (recorded next to the decision)"
              />
              <div className="flex gap-2">
                <button onClick={override} disabled={busy || !overrideValue || !overrideReason.trim()} className="btn-primary text-xs">
                  Save override
                </button>
                <button onClick={() => setOverriding(false)} className="btn-ghost text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-stone-400">
            Ineligible jobs say do not apply unless you override with a reason.
            The decision stays yours.
          </p>
        </>
      )}
    </section>
  );
}
