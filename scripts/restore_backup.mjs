/**
 * Restore procedure (Prompt 24): restores a Career Desk export's json/ files
 * into a fresh Supabase/Postgres project that has the migrations applied.
 *
 * Usage:
 *   node scripts/restore_backup.mjs <project-url> <service-role-key> <export-dir>
 * where <export-dir> contains json/<table>.json files (from the ZIP).
 *
 * After inserting, the script prints per-table row counts so they can be
 * compared with the original, and reminds you to open a sample PDF.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const [url, key, dir] = process.argv.slice(2);
if (!url || !key || !dir) {
  console.error("Usage: node scripts/restore_backup.mjs <project-url> <service-key> <export-dir>");
  process.exit(1);
}

const TABLES = [
  "user_settings",
  "career_entries",
  "voice_samples",
  "skills",
  "skill_evidence",
  "skill_assessments",
  "role_skill_requirements",
  "ai_assessments",
  "plan_items",
  "projects",
  "project_deliverables",
  "hour_logs",
  "weekly_reviews",
  "jobs",
  "status_history",
  "applications",
  "application_documents",
  "ai_usage",
  "corrections",
  "prompt_rules",
  "eval_cases",
];

// user_id is preserved from the export: create the owner in the fresh
// project first (Supabase dashboard -> Authentication -> Add user) using the
// same UUID, or the FK inserts will fail.
const admin = createClient(url, key, { auth: { persistSession: false } });
const counts = {};
for (const table of TABLES) {
  const file = path.join(dir, "json", `${table}.json`);
  if (!fs.existsSync(file)) continue;
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    counts[table] = 0;
    continue;
  }
  const { error } = await admin.from(table).upsert(rows, { ignoreDuplicates: false });
  if (error) {
    console.error(`  FAIL ${table}: ${error.message}`);
    counts[table] = `error: ${error.message}`;
    continue;
  }
  counts[table] = rows.length;
}
console.log("Restored row counts (compare with the original):");
for (const [table, count] of Object.entries(counts)) {
  console.log(`  ${table}: ${count}`);
}
console.log("\nNow: confirm row counts match the export, then download one PDF");
console.log("from the pdfs/ folder and open it. Keep the fresh project private.");
