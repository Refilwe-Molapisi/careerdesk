import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { listJobs } from "@/lib/data/queries/jobs";
import { JobsBoard } from "@/components/jobs/jobs-board";

export const metadata: Metadata = {
  title: "Jobs",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireUser();
  const [{ status }, jobs] = await Promise.all([searchParams, listJobs(supabase)]);

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Saved vacancies move from Saved through Tailoring and Ready to Applied and beyond. Every status change is written to history."
      />
      <Suspense fallback={null}>
        <JobsBoard jobs={jobs} initialStatusFilter={status ?? "all"} />
      </Suspense>
    </>
  );
}
