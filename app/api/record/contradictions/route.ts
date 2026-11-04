import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { listCareerEntries } from "@/lib/data/queries/career";
import { detectContradictions } from "@/lib/operations/quality";
import type { CareerEntryType } from "@/lib/data/types";

/**
 * POST /api/record/contradictions  (Prompt 22 item 4)
 * Deterministic contradiction check for a proposed Career Record entry:
 * overlapping employment dates, conflicting titles at one employer,
 * inconsistent figures across employers. Advisory only - saving stays
 * possible; the warnings are shown with both entries.
 */
export async function POST(request: Request) {
  const { supabase } = await requireUser();

  let body: {
    id?: unknown;
    title?: unknown;
    organisation?: unknown;
    type?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    description?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const proposed = {
    id: typeof body.id === "string" ? body.id : null,
    title: typeof body.title === "string" ? body.title : "",
    organisation: typeof body.organisation === "string" ? body.organisation : null,
    type: (typeof body.type === "string" ? body.type : "job") as CareerEntryType,
    start_date: typeof body.start_date === "string" && body.start_date ? body.start_date : null,
    end_date: typeof body.end_date === "string" && body.end_date ? body.end_date : null,
    description: typeof body.description === "string" ? body.description : null,
  };
  if (!proposed.title.trim()) {
    return NextResponse.json({ error: "Title required." }, { status: 400 });
  }

  const entries = await listCareerEntries(supabase);
  return NextResponse.json({
    contradictions: detectContradictions(proposed, entries),
  });
}
