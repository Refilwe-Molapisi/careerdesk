import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { NewJobForm } from "@/components/jobs/new-job-form";

export const metadata: Metadata = {
  title: "Add job",
};

export default async function NewJobPage() {
  const { user } = await requireUser();

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
      <PageHeader
        title="Add a job"
        description="Paste the job description. The app reads it on the server, proposes the details, and you confirm before anything is saved. Links are stored, never scraped."
      />
      <NewJobForm userId={user.id} />
    </>
  );
}
