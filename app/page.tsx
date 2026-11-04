import { redirect } from "next/navigation";
import { createClient } from "@/lib/data/supabase/server";

// The root page reads the session; keep it out of build-time prerendering.
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
