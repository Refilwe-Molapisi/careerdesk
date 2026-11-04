import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { getJob } from "@/lib/data/queries/jobs";
import { listCareerEntries } from "@/lib/data/queries/career";
import { listJobDocuments } from "@/lib/data/queries/documents";
import { DocumentReview } from "@/components/jobs/document-review";

export const metadata: Metadata = {
  title: "Review documents",
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const [{ id }, { doc }] = await Promise.all([params, searchParams]);

  const job = await getJob(supabase, id);
  if (!job || job.user_id !== user.id) notFound();

  const [documents, entries] = await Promise.all([
    listJobDocuments(supabase, id),
    listCareerEntries(supabase),
  ]);

  if (documents.length === 0) notFound();
  const selected = doc ? documents.find((d) => d.id === doc) : undefined;
  if (doc && !selected) notFound();

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/jobs/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to job
        </Link>
      </div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-stone-900">
          Review documents
        </h1>
        <p className="text-sm text-stone-500">
          {[job.title ?? "Untitled role", job.company].filter(Boolean).join(" · ")}
        </p>
      </div>
      <DocumentReview
        jobId={id}
        documents={documents}
        entries={entries}
        initialDocumentId={selected?.id ?? documents[0].id}
      />
    </>
  );
}
