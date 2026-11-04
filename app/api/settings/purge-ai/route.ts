import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";

/**
 * POST /api/settings/purge-ai  (Prompt 24)
 * Deletes all AI-generated material - drafts, assessments, feedback,
 * corrections, ledger - without touching the Career Record, jobs board
 * core data or settings. Exported PDFs of sent applications stay attached
 * to their application rows; the document rows go.
 */
export async function POST() {
  const { user, supabase } = await requireUser();

  const tables = [
    "application_documents",
    "skill_assessments",
    "ai_assessments",
    "corrections",
    "eval_cases",
    "ai_usage",
  ];
  const deleted: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("user_id", user.id);
    if (error) {
      // A table from a migration that has not been applied yet is not a
      // failure: there is nothing of the user's in it to delete.
      if (error.code === "42P01" || /does not exist/i.test(error.message)) {
        deleted[table] = 0;
        continue;
      }
      return NextResponse.json(
        { error: `${table}: ${error.message}` },
        { status: 500 },
      );
    }
    deleted[table] = count ?? 0;
  }

  return NextResponse.json({ deleted });
}
