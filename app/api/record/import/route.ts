import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/operations/rate-limit";
import { createClient } from "@/lib/data/supabase/server";
import {
  AiUnavailableError,
  AiValidationError,
} from "@/lib/intelligence/deepseek";
import {
  MAX_CV_IMPORT_CHARS,
  proposeCareerEntriesFromCv,
} from "@/lib/intelligence/tasks/cv-import";

/**
 * POST /api/record/import
 * Body: { text: string } - pasted CV text.
 * Returns { proposals: [...] } for the user to accept, edit or reject one by
 * one. Nothing is saved automatically: the client performs the inserts after
 * explicit review, through RLS-protected table access.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const limiter = rateLimit(`cv-import:${user.id}`, 10, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: `Too many AI requests. Try again in ${limiter.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text =
    typeof (body as { text?: unknown })?.text === "string"
      ? ((body as { text: string }).text ?? "").trim()
      : "";

  if (text.length < 50) {
    return NextResponse.json(
      { error: "Paste a bit more CV text (at least 50 characters)." },
      { status: 400 },
    );
  }
  if (text.length > MAX_CV_IMPORT_CHARS) {
    return NextResponse.json(
      {
        error: `CV text is too long (maximum ${MAX_CV_IMPORT_CHARS.toLocaleString("en")} characters). Trim it and try again.`,
      },
      { status: 413 },
    );
  }

  try {
    const proposals = await proposeCareerEntriesFromCv(text);
    return NextResponse.json({ proposals });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error(
      "cv import failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}
