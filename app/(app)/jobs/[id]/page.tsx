import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { getApplicationForJob, getJob, listStatusHistory } from "@/lib/data/queries/jobs";
import { listJobDocuments } from "@/lib/data/queries/documents";
import { JobDetailClient } from "@/components/jobs/job-detail-client";

export const metadata: Metadata = {
  title: "Job",
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const job = await getJob(supabase, id);
  // RLS already limits rows to the owner; notFound() covers missing or
  // foreign ids so a guessing browser sees a 404, not an error.
  if (!job || job.user_id !== user.id) notFound();

  const [history, application, documents] = await Promise.all([
    listStatusHistory(supabase, id),
    getApplicationForJob(supabase, id),
    listJobDocuments(supabase, id),
  ]);

  return (
    <>
      <div className="mb-4">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Jobs
        </Link>
      </div>
      <JobDetailClient
        job={job}
        history={history}
        applied={application !== null}
        documents={documents}
      />
    </>
  );
}
