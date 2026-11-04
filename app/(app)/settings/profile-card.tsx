"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/data/supabase/browser";
import { saveProfile } from "@/lib/data/queries/career";

type ProfileCardProps = {
  userId: string;
  email: string | null;
  initialFullName: string;
  initialMinimumSalary: string;
  initialMinimumSalaryCurrency: string;
  initialMonthlyCap: string;
  initialRetentionDays: string;
};

/** Full name used in exported PDF file names (Prompt 8). */
export function ProfileCard({
  userId,
  email,
  initialFullName,
  initialMinimumSalary,
  initialMinimumSalaryCurrency,
  initialMonthlyCap,
  initialRetentionDays,
}: ProfileCardProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [minimumSalary, setMinimumSalary] = useState(initialMinimumSalary);
  const [minimumSalaryCurrency, setMinimumSalaryCurrency] = useState(
    initialMinimumSalaryCurrency,
  );
  const [monthlyCap, setMonthlyCap] = useState(initialMonthlyCap);
  const [retentionDays, setRetentionDays] = useState(initialRetentionDays);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile(createClient(), userId, {
        full_name: fullName.trim() || null,
        minimum_salary: minimumSalary ? Number(minimumSalary) : null,
        minimum_salary_currency: minimumSalaryCurrency.trim() || null,
        monthly_cap_usd: monthlyCap ? Number(monthlyCap) : null,
        recording_retention_days: retentionDays ? Number(retentionDays) : null,
      });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-base font-semibold text-stone-900">Profile</h2>
      <p className="mb-4 text-sm text-stone-500">
        Your name is used in exported PDF files, named like{" "}
        <span className="font-mono text-xs">Firstname-Surname_Company_Role_v1.pdf</span>.
      </p>
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="full-name" className="label">
            Full name
          </label>
          <input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input sm:max-w-xs"
            placeholder="e.g. Refilwe Molapisi"
          />
        </div>
        <button type="submit" disabled={saving} className="btn-outline">
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-stone-100 pt-4">
        <div>
          <label htmlFor="min-salary" className="label">
            Minimum salary (Prompt 23 factor)
          </label>
          <input
            id="min-salary"
            type="number"
            min={0}
            value={minimumSalary}
            onChange={(e) => setMinimumSalary(e.target.value)}
            className="input sm:max-w-40"
            placeholder="e.g. 30000"
          />
        </div>
        <div>
          <label htmlFor="min-currency" className="label">
            Currency
          </label>
          <input
            id="min-currency"
            value={minimumSalaryCurrency}
            onChange={(e) => setMinimumSalaryCurrency(e.target.value)}
            className="input sm:max-w-24"
            placeholder="ZAR"
          />
        </div>
        <div>
          <label htmlFor="monthly-cap" className="label">
            Monthly AI cap (USD)
          </label>
          <input
            id="monthly-cap"
            type="number"
            min={0}
            step="0.5"
            value={monthlyCap}
            onChange={(e) => setMonthlyCap(e.target.value)}
            className="input sm:max-w-28"
            placeholder="e.g. 5"
          />
        </div>
        <div>
          <label htmlFor="retention" className="label">
            Recording retention (days)
          </label>
          <input
            id="retention"
            type="number"
            min={0}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="input sm:max-w-24"
            placeholder="e.g. 90"
          />
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-400">
        At 80% of the monthly cap the app warns you; at 100% non-essential AI
        features stop (the tailoring pipeline and eligibility keep working).
        Recording retention applies to interview audio when that stage is
        built: recordings older than the setting are deleted automatically.
      </p>
      <p className="mt-2 text-xs text-stone-400">
        Signed in as {email ?? "unknown"}.
      </p>
    </section>
  );
}
