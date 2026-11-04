"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import { saveProfile } from "@/lib/data/queries/career";

type RemindersCardProps = {
  userId: string;
  initialEmail: string;
  initialEnabled: boolean;
  fallbackEmail: string;
};

/**
 * Daily reminder settings (Prompt 9). The cron sends to the stored address
 * only when the toggle is on; "Send test email" exercises the whole chain.
 */
export function RemindersCard({
  userId,
  initialEmail,
  initialEnabled,
  fallbackEmail,
}: RemindersCardProps) {
  const [email, setEmail] = useState(initialEmail);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function persist(next: {
    reminder_email?: string | null;
    reminders_enabled?: boolean;
  }) {
    setSaving(true);
    try {
      await saveProfile(createClient(), userId, next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSending(true);
    try {
      const res = await fetch("/api/settings/send-test-email", {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "The test email could not be sent.");
      }
      toast.success(`Test email sent to ${payload.to}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-stone-900">
        <Mail className="h-4 w-4 text-accent" aria-hidden />
        Daily email reminders
      </h2>
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-stone-500">
        Sent once a day at 07:00 South African time: follow-ups due or
        overdue, jobs in Applied with no update for 7 days, and plan items due
        this week. Nothing is sent on quiet days. The sender domain must be
        verified in Resend before sending from your own address.
      </p>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 sm:max-w-sm">
            <label htmlFor="reminder-email" className="label">
              Send to
            </label>
            <input
              id="reminder-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={fallbackEmail}
              className="input"
            />
          </div>
          <button
            onClick={() => {
              void persist({ reminder_email: email.trim() || null });
              toast.success("Reminder address saved.");
            }}
            disabled={saving}
            className="btn-outline"
          >
            {saving ? "Saving..." : "Save address"}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              void persist({ reminders_enabled: e.target.checked });
              toast.success(
                e.target.checked ? "Reminders on." : "Reminders off.",
              );
            }}
            className="h-4 w-4 rounded border-stone-300 text-accent focus:ring-accent"
          />
          Reminders on
        </label>

        <div>
          <button
            onClick={sendTest}
            disabled={sending}
            className="btn-outline"
          >
            <Send className="h-4 w-4" aria-hidden />
            {sending ? "Sending..." : "Send test email"}
          </button>
          <p className="mt-1.5 text-xs text-stone-400">
            Sends whatever is currently due so you can check Resend works.
          </p>
        </div>
      </div>
    </section>
  );
}
