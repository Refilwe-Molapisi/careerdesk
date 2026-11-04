"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/data/supabase/browser";
import { saveProfile } from "@/lib/data/queries/career";

type ProfileCardProps = {
  userId: string;
  email: string | null;
  initialFullName: string;
};

/** Full name used in exported PDF file names (Prompt 8). */
export function ProfileCard({ userId, email, initialFullName }: ProfileCardProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile(createClient(), userId, {
        full_name: fullName.trim() || null,
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
      <p className="mt-2 text-xs text-stone-400">
        Signed in as {email ?? "unknown"}.
      </p>
    </section>
  );
}
