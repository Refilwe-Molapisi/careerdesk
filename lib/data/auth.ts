import { redirect } from "next/navigation";
import { createClient } from "@/lib/data/supabase/server";

/**
 * Guards a private page: redirects to /login when there is no valid session
 * (the proxy does this too; this is the second line of defence) and returns
 * the user plus a server Supabase client for data access.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { user, supabase };
}
