import { NextResponse } from "next/server";
import { createClient } from "@/lib/data/supabase/server";

/**
 * Supabase auth callback: exchanges the code from a magic link or email
 * confirmation for a session cookie, then continues into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
