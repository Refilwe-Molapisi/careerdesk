import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/data/supabase/env";

/**
 * Supabase client for Client Components (browser).
 * Uses the anon key; Row Level Security is the enforcement layer.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
