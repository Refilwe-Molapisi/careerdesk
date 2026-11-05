"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Database, Download, FileText, LogOut, Trash2 } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";

/**
 * Data ownership card (Prompt 24): export ZIP, purge AI material, sign out
 * of all sessions, and links to the AI data notice.
 */
export function DataCard({ email }: { email: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function purge() {
    setBusy("purge");
    try {
      const res = await fetch("/api/settings/purge-ai", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Purge failed.");
      const total = Object.values(payload.deleted as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      );
      toast.success(`${total} AI-generated rows deleted. Your Career Record and settings are untouched.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purge failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-stone-900">
        <Database className="h-4 w-4 text-accent" aria-hidden />
        Your data
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-stone-500">
        Everything in this app is yours. Export it as a ZIP (JSON and CSV for
        every table, plus every PDF), delete all AI-generated material without
        touching your Career Record, or sign out everywhere.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/settings/export" className="btn-outline" download>
          <Download className="h-4 w-4" aria-hidden /> Export all data (ZIP)
        </a>
        <Link className="btn-outline" href="/settings/ai-notice">
          <FileText className="h-4 w-4" aria-hidden /> AI data notice
        </Link>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="btn-outline !border-red-200 !text-red-700" disabled={busy !== null}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete AI-generated material
          </button>
        ) : (
          <span className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            Drafts, assessments and the ledger go; your record stays.
            <button onClick={purge} disabled={busy !== null} className="font-semibold underline">
              {busy === "purge" ? "Deleting..." : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} className="underline">Cancel</button>
          </span>
        )}
        <button
          onClick={async () => {
            setBusy("signout");
            try {
              await createClient().auth.signOut({ scope: "global" });
              router.replace("/login");
            } catch {
              toast.error("Could not sign out.");
              setBusy(null);
            }
          }}
          disabled={busy !== null}
          className="btn-ghost"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Sign out of all sessions
        </button>
      </div>
      <p className="mt-3 text-xs text-stone-400">
        Single job and document deletion lives where the data lives: the job
        page and the review screen. Signed in as {email ?? "unknown"}.
      </p>
    </section>
  );
}
