import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Application,
  Job,
  JobInput,
  StatusHistoryEntry,
} from "@/lib/data/types";

/** Typed queries for jobs, status history and applications. */

type QueryClient = SupabaseClient;

export async function listJobs(client: QueryClient): Promise<Job[]> {
  const { data, error } = await client
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Job[];
}

export async function getJob(client: QueryClient, id: string): Promise<Job | null> {
  const { data, error } = await client
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Job) ?? null;
}

export async function createJob(
  client: QueryClient,
  values: JobInput,
): Promise<Job> {
  const { data, error } = await client
    .from("jobs")
    .insert(values)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Job;
}

export async function updateJob(
  client: QueryClient,
  id: string,
  values: Partial<
    Pick<
      Job,
      | "title"
      | "company"
      | "location"
      | "work_mode"
      | "status"
      | "follow_up_date"
      | "notes"
      | "role_family"
    >
  >,
): Promise<Job> {
  const { data, error } = await client
    .from("jobs")
    .update(values)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Job;
}

export async function deleteJob(client: QueryClient, id: string): Promise<void> {
  const { error } = await client.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listStatusHistory(
  client: QueryClient,
  jobId: string,
): Promise<StatusHistoryEntry[]> {
  const { data, error } = await client
    .from("status_history")
    .select("*")
    .eq("job_id", jobId)
    .order("changed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StatusHistoryEntry[];
}

export async function getApplicationForJob(
  client: QueryClient,
  jobId: string,
): Promise<Application | null> {
  const { data, error } = await client
    .from("applications")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Application) ?? null;
}

/** Atomic server-side RPC: sets status applied + creates the applications row. */
export async function markJobApplied(
  client: QueryClient,
  jobId: string,
): Promise<void> {
  const { error } = await client.rpc("mark_job_applied", {
    p_job_id: jobId,
  });
  if (error) throw new Error(error.message);
}

export async function listApplications(
  client: QueryClient,
): Promise<Application[]> {
  const { data, error } = await client
    .from("applications")
    .select("*")
    .order("applied_on", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Application[];
}

/** Documents linked to a job (tailoring arrives in a later prompt). */
export type DocumentStub = {
  id: string;
  kind: "cv" | "cover_letter";
  version: number;
  status: "draft" | "approved" | "superseded";
  template: string | null;
  created_at: string;
};

export async function listJobDocuments(
  client: QueryClient,
  jobId: string,
): Promise<DocumentStub[]> {
  const { data, error } = await client
    .from("application_documents")
    .select("id, kind, version, status, template, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentStub[];
}
