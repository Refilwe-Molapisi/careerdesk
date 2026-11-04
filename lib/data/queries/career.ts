import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CareerEntry,
  CareerEntryInput,
  UserSettings,
  VoiceSample,
} from "@/lib/data/types";

/**
 * Typed queries for the Career Record area (career entries, voice samples,
 * user settings). A Supabase client (browser or server) is passed in; Row
 * Level Security is the enforcement layer, and user_id is always supplied
 * explicitly from the session user.
 */

type QueryClient = SupabaseClient;

// ---------------------------------------------------------------------------
// Career entries
// ---------------------------------------------------------------------------

export async function listCareerEntries(
  client: QueryClient,
): Promise<CareerEntry[]> {
  const { data, error } = await client
    .from("career_entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CareerEntry[];
}

export async function createCareerEntry(
  client: QueryClient,
  values: CareerEntryInput,
): Promise<CareerEntry> {
  const { data, error } = await client
    .from("career_entries")
    .insert(values)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CareerEntry;
}

export async function createCareerEntries(
  client: QueryClient,
  values: CareerEntryInput[],
): Promise<CareerEntry[]> {
  const { data, error } = await client
    .from("career_entries")
    .insert(values)
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as CareerEntry[];
}

export async function updateCareerEntry(
  client: QueryClient,
  id: string,
  values: Partial<CareerEntryInput>,
): Promise<CareerEntry> {
  const { data, error } = await client
    .from("career_entries")
    .update(values)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CareerEntry;
}

export async function deleteCareerEntry(
  client: QueryClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("career_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Voice samples
// ---------------------------------------------------------------------------

export async function listVoiceSamples(
  client: QueryClient,
): Promise<VoiceSample[]> {
  const { data, error } = await client
    .from("voice_samples")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as VoiceSample[];
}

export async function createVoiceSample(
  client: QueryClient,
  values: { user_id: string; label: string; content: string },
): Promise<VoiceSample> {
  const { data, error } = await client
    .from("voice_samples")
    .insert(values)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as VoiceSample;
}

export async function deleteVoiceSample(
  client: QueryClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("voice_samples").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// User settings
// ---------------------------------------------------------------------------

export async function getUserSettings(
  client: QueryClient,
  userId: string,
): Promise<UserSettings | null> {
  const { data, error } = await client
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserSettings) ?? null;
}

export async function saveBannedPhrases(
  client: QueryClient,
  userId: string,
  phrases: string[],
): Promise<void> {
  const { error } = await client.from("user_settings").upsert(
    { user_id: userId, banned_phrases: phrases },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export async function saveProfile(
  client: QueryClient,
  userId: string,
  values: {
    full_name?: string | null;
    reminder_email?: string | null;
    reminders_enabled?: boolean;
    minimum_salary?: number | null;
    minimum_salary_currency?: string | null;
    monthly_cap_usd?: number | null;
    recording_retention_days?: number | null;
  },
): Promise<void> {
  const { error } = await client.from("user_settings").upsert(
    { user_id: userId, ...values },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}
