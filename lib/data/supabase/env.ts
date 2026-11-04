/**
 * Reads the Supabase environment variables with a clear, actionable error
 * instead of an opaque crash, so a deployment without configuration shows a
 * setup screen rather than failing.
 */

export class MissingSupabaseEnvError extends Error {
  constructor() {
    super(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example), then restart the server or redeploy.",
    );
    this.name = "MissingSupabaseEnvError";
  }
}

export type SupabaseEnv = { url: string; anonKey: string };

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new MissingSupabaseEnvError();
  return { url, anonKey };
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
