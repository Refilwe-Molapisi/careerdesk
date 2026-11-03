import { NextResponse } from "next/server";
import { createClient } from "@/lib/data/supabase/server";
import {
  AiUnavailableError,
  AiValidationError,
} from "@/lib/intelligence/deepseek";
import {
  MAX_JOB_DESCRIPTION_CHARS,
  extractJobFromDescription,
  type JobExtractionHints,
} from "@/lib/intelligence/tasks/job-extract";
import type { WorkMode } from "@/lib/data/types";

/**
 * POST /api/jobs/extract
 * Body: { description: string, hints?: {title, company, location, work_mode} }
 * Returns the extraction for review before saving. The link is stored, never
 * scraped; only the pasted description is read.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as {
    description?: unknown;
    hints?: Record<string, unknown>;
  };

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length < 50) {
    return NextResponse.json(
      { error: "Paste a bit more of the job description (at least 50 characters)." },
      { status: 400 },
    );
  }
  if (description.length > MAX_JOB_DESCRIPTION_CHARS) {
    return NextResponse.json(
      {
        error: `Description is too long (maximum ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString("en")} characters).`,
      },
      { status: 413 },
    );
  }

  const hints: JobExtractionHints = {
    title: typeof b.hints?.title === "string" ? b.hints.title : null,
    company: typeof b.hints?.company === "string" ? b.hints.company : null,
    location: typeof b.hints?.location === "string" ? b.hints.location : null,
    work_mode:
      typeof b.hints?.work_mode === "string"
        ? (b.hints.work_mode as WorkMode)
        : null,
  };

  try {
    const extraction = await extractJobFromDescription(description, hints);
    return NextResponse.json({ extraction });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error(
      "job extraction failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
