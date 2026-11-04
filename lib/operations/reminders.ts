import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@/lib/data/types";

/**
 * Daily reminder email (Prompt 9): follow-ups due today or overdue, jobs in
 * Applied with no update for 7 days, and plan items due this week. Sent via
 * Resend only to the user's own stored address; skipped entirely when there
 * is nothing to list.
 */

export type ReminderData = {
  followUps: Job[];
  staleApplied: Job[];
  planItems: { title: string; due_date: string | null; category: string | null }[];
};

export type ReminderUser = {
  userId: string;
  email: string;
  data: ReminderData;
};

function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function collectReminderData(
  client: SupabaseClient,
): Promise<ReminderData> {
  const today = new Date();
  const todayIso = toDateIso(today);

  const staleCutoff = new Date(today);
  staleCutoff.setDate(today.getDate() - 7);

  // Monday..Sunday of the current week (South African convention: week
  // starts Monday).
  const monday = new Date(today);
  const dow = today.getDay(); // 0 = Sunday
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [jobsRes, planRes] = await Promise.all([
    client
      .from("jobs")
      .select("*")
      .or(`follow_up_date.lte.${todayIso},and(status.eq.applied,status_updated_at.lt.${staleCutoff.toISOString()})`),
    client
      .from("plan_items")
      .select("title, due_date, category")
      .gte("due_date", toDateIso(monday))
      .lte("due_date", toDateIso(sunday))
      .neq("status", "done"),
  ]);

  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (planRes.error) throw new Error(planRes.error.message);

  const jobs = (jobsRes.data ?? []) as Job[];
  return {
    followUps: jobs
      .filter((j) => j.follow_up_date !== null && j.follow_up_date <= todayIso)
      .sort((a, b) => (a.follow_up_date ?? "").localeCompare(b.follow_up_date ?? "")),
    staleApplied: jobs.filter(
      (j) =>
        j.status === "applied" &&
        new Date(j.status_updated_at) < staleCutoff,
    ),
    planItems: (planRes.data ?? []) as ReminderData["planItems"],
  };
}

export async function listReminderUsers(
  client: SupabaseClient,
): Promise<{ userId: string; email: string }[]> {
  const { data, error } = await client
    .from("user_settings")
    .select("user_id, reminder_email, reminders_enabled, full_name")
    .eq("reminders_enabled", true)
    .not("reminder_email", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    userId: row.user_id as string,
    email: row.reminder_email as string,
  }));
}

export function hasAnything(data: ReminderData): boolean {
  return (
    data.followUps.length > 0 ||
    data.staleApplied.length > 0 ||
    data.planItems.length > 0
  );
}

export function buildReminderEmail(data: ReminderData): {
  subject: string;
  html: string;
} {
  const section = (title: string, items: string[]) =>
    items.length === 0
      ? ""
      : `<h3 style="font:600 14px/1.4 -apple-system,Segoe UI,sans-serif;color:#1f2937;margin:16px 0 6px;">${title}</h3>
         <ul style="margin:0;padding-left:18px;font:400 13px/1.6 -apple-system,Segoe UI,sans-serif;color:#374151;">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

  const followUpItems = data.followUps.map((job) => {
    const overdue = (job.follow_up_date ?? "") < toDateIso(new Date());
    return `${escapeHtml(job.title ?? "Untitled role")}${job.company ? ` - ${escapeHtml(job.company)}` : ""} <strong style="color:${overdue ? "#b91c1c" : "#4f46e5"}">(${overdue ? "overdue: " : ""}${job.follow_up_date})</strong>`;
  });
  const staleItems = data.staleApplied.map(
    (job) =>
      `${escapeHtml(job.title ?? "Untitled role")}${job.company ? ` - ${escapeHtml(job.company)}` : ""} <strong style="color:#b45309">(applied, no update since ${job.status_updated_at.slice(0, 10)})</strong>`,
  );
  const planItems = data.planItems.map(
    (item) =>
      `${escapeHtml(item.title)} <span style="color:#9ca3af">(${escapeHtml(item.due_date ?? "no date")})</span>`,
  );

  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,sans-serif;">
    <h2 style="font:600 18px/1.4;color:#111827;margin:0 0 4px;">Your Career Desk day</h2>
    <p style="margin:0;color:#9ca3af;font:400 12px/1.5;">${new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
    ${section("Follow-ups due today or overdue", followUpItems)}
    ${section("Applied, no update for 7+ days", staleItems)}
    ${section("Plan items due this week", planItems)}
    <p style="margin:24px 0 0;color:#9ca3af;font:400 11px/1.5;">Sent by your Career Desk. Change or switch these off in Settings.</p>
  </div>`;

  return { subject: `Career Desk reminders: ${totalItems(data)} due today`, html };
}

function totalItems(data: ReminderData): number {
  return data.followUps.length + data.staleApplied.length + data.planItems.length;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class ResendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResendError";
  }
}

/** Sends via the Resend REST API; no SDK, fetch only. */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ResendError(
      "Email is not configured: set RESEND_API_KEY and REMINDER_FROM_EMAIL.",
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ResendError(
      `Resend returned ${res.status}. Verify your sender domain in Resend. ${body.slice(0, 200)}`,
    );
  }
  const payload = (await res.json()) as { id?: string };
  return { id: payload.id ?? "unknown" };
}
