import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dumps every table the user owns as JSON and CSV (Prompt 24). CSV is a
 * minimal RFC 4180 writer - fine for single-user exports opened in Excel.
 */

export const EXPORT_TABLES = [
  "career_entries",
  "voice_samples",
  "jobs",
  "status_history",
  "applications",
  "application_documents",
  "skills",
  "skill_evidence",
  "skill_assessments",
  "role_skill_requirements",
  "ai_assessments",
  "ai_usage",
  "corrections",
  "prompt_rules",
  "eval_cases",
  "plan_items",
  "projects",
  "project_deliverables",
  "hour_logs",
  "weekly_reviews",
  "user_settings",
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\n");
}

export async function dumpUserData(
  client: SupabaseClient,
  userId: string,
): Promise<Record<string, Record<string, unknown>[]>> {
  const dump: Record<string, Record<string, unknown>[]> = {};
  for (const table of EXPORT_TABLES) {
    const { data, error } = await client.from(table).select("*").eq("user_id", userId);
    if (error) {
      dump[table] = [{ error: error.message }];
      continue;
    }
    dump[table] = (data ?? []) as Record<string, unknown>[];
  }
  return dump;
}
