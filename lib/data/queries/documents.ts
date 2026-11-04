import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationDocument } from "@/lib/data/types";

/** Typed queries for application_documents (tailored CV / cover letter versions). */

type QueryClient = SupabaseClient;

export async function listJobDocuments(
  client: QueryClient,
  jobId: string,
): Promise<ApplicationDocument[]> {
  const { data, error } = await client
    .from("application_documents")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApplicationDocument[];
}

export async function getDocument(
  client: QueryClient,
  id: string,
): Promise<ApplicationDocument | null> {
  const { data, error } = await client
    .from("application_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ApplicationDocument) ?? null;
}

export async function listAllDocuments(
  client: QueryClient,
): Promise<ApplicationDocument[]> {
  const { data, error } = await client
    .from("application_documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApplicationDocument[];
}

export async function nextDocumentVersion(
  client: QueryClient,
  jobId: string,
  kind: "cv" | "cover_letter",
): Promise<number> {
  const { data, error } = await client
    .from("application_documents")
    .select("version")
    .eq("job_id", jobId)
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data?.[0]?.version as number | undefined) ?? 0) + 1;
}

export async function createDocument(
  client: QueryClient,
  values: {
    user_id: string;
    job_id: string;
    kind: "cv" | "cover_letter";
    version: number;
    parent_version_id?: string | null;
    template: string;
    status?: "draft" | "approved" | "superseded";
    content_json: unknown;
    source_map: unknown;
  },
): Promise<ApplicationDocument> {
  const { data, error } = await client
    .from("application_documents")
    .insert(values)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ApplicationDocument;
}

export async function updateDocumentDraft(
  client: QueryClient,
  id: string,
  values: {
    content_json?: unknown;
    source_map?: unknown;
    template?: string;
    status?: "draft" | "approved" | "superseded";
    pdf_path?: string | null;
    pdf_sha256?: string | null;
  },
): Promise<ApplicationDocument> {
  const { data, error } = await client
    .from("application_documents")
    .update(values)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ApplicationDocument;
}
