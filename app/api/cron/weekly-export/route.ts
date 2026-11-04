import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createServiceClient } from "@/lib/data/supabase/service";
import { dumpUserData, toCsv, EXPORT_TABLES } from "@/lib/operations/export-data";
import { listReminderUsers } from "@/lib/operations/reminders";

/**
 * GET /api/cron/weekly-export  (Prompt 24)
 * Vercel Cron (weekly): dumps every user's data to a private storage folder
 * documents/<user>/backups/<iso-week>.zip. Protected by CRON_SECRET.
 * Restore procedure: README "Backups and restore" (tested by
 * scripts/restore_backup.mjs against a fresh database).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  if (!secret || provided !== `Bearer ${secret}`) {
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

  const users = await listReminderUsers(service).catch(() => []);
  const results: { userId: string; status: string }[] = [];

  for (const { userId } of users) {
    try {
      const dump = await dumpUserData(service, userId);
      const zip = new JSZip();
      for (const table of EXPORT_TABLES) {
        const rows = dump[table] ?? [];
        zip.file(`json/${table}.json`, JSON.stringify(rows, null, 2));
        zip.file(`csv/${table}.csv`, toCsv(rows));
      }
      const content = await zip.generateAsync({ type: "nodebuffer" });
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);
      const week = Math.ceil(
        ((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
      );
      const path = `${userId}/backups/${now.getFullYear()}-W${String(week).padStart(2, "0")}.zip`;
      const { error } = await service.storage
        .from("documents")
        .upload(path, content, { contentType: "application/zip", upsert: true });
      if (error) throw new Error(error.message);
      results.push({ userId, status: "uploaded" });
    } catch (err) {
      console.error(`weekly export failed for ${userId}:`, err instanceof Error ? err.message : err);
      results.push({ userId, status: "failed" });
    }
  }

  return NextResponse.json({ ran_at: new Date().toISOString(), results });
}
