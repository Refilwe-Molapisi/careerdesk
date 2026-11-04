import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { getUserSettings } from "@/lib/data/queries/career";
import {
  buildReminderEmail,
  collectReminderData,
  sendEmail,
} from "@/lib/operations/reminders";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * POST /api/settings/send-test-email
 * Sends a real reminder-style email to the signed-in user's reminder address
 * using whatever is currently due, so the whole chain (Resend config, sender
 * domain, content) can be checked from Settings.
 */
export async function POST() {
  const { user, supabase } = await requireUser();

  const limiter = rateLimit(`test-email:${user.id}`, 3, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Too many test emails. Try again in a moment." },
      { status: 429 },
    );
  }

  const settings = await getUserSettings(supabase, user.id);
  const to = settings?.reminder_email || user.email;
  if (!to) {
    return NextResponse.json(
      { error: "Set a reminder email address first." },
      { status: 400 },
    );
  }

  const data = await collectReminderData(supabase, user.id);
  const { subject, html } = buildReminderEmail(data);

  try {
    const preview = [
      data.followUps.length,
      data.staleApplied.length,
      data.planItems.length,
    ].reduce((a, b) => a + b, 0);
    await sendEmail({
      to,
      subject: preview === 0 ? "Career Desk test email (nothing due right now)" : subject,
      html,
    });
    return NextResponse.json({ sent: true, to });
  } catch (err) {
    // Surface Resend problems to the user instead of crashing.
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "The test email could not be sent.",
      },
      { status: 502 },
    );
  }
}
