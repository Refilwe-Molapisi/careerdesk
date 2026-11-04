import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/data/supabase/service";
import {
  buildReminderEmail,
  collectReminderData,
  hasAnything,
  listReminderUsers,
  sendEmail,
} from "@/lib/operations/reminders";

/**
 * GET /api/cron/daily-reminders
 * Called once a day by Vercel Cron ("0 5 * * *" UTC = 07:00 Africa/
 * Johannesburg, which has no daylight saving). Protected by CRON_SECRET:
 * Vercel sends it automatically as "Authorization: Bearer <CRON_SECRET>".
 * Resend failures are reported per user and never crash the route.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  if (!secret || provided !== expected) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Not configured." },
      { status: 503 },
    );
  }

  let users: { userId: string; email: string }[];
  try {
    users = await listReminderUsers(service);
  } catch (err) {
    console.error("reminder settings read failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not read reminder settings." }, { status: 500 });
  }

  const results: { userId: string; status: string; detail?: string }[] = [];

  for (const { userId, email } of users) {
    try {
      const data = await collectReminderData(service);
      if (!hasAnything(data)) {
        results.push({ userId, status: "skipped_empty" });
        continue;
      }
      const { subject, html } = buildReminderEmail(data);
      await sendEmail({ to: email, subject, html });
      results.push({ userId, status: "sent" });
    } catch (err) {
      // A failed send must never crash the cron run.
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`reminder for ${userId} failed:`, detail);
      results.push({ userId, status: "failed", detail });
    }
  }

  return NextResponse.json({ ran_at: new Date().toISOString(), results });
}
