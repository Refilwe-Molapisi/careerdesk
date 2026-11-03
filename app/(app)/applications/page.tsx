import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/data/auth";
import { listApplications, listJobs } from "@/lib/data/queries/jobs";
import { JOB_STATUS_LABELS, type Application, type Job } from "@/lib/data/types";
import { EmptyState } from "@/components/ui/empty-state";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Applications",
};

export default async function ApplicationsPage() {
  const { supabase } = await requireUser();
  const [applications, jobs] = await Promise.all([
    listApplications(supabase),
    listJobs(supabase),
  ]);

  if (applications.length === 0) {
    return (
      <>
        <PageHeader
          title="Applications"
          description="Every application you recorded, with the date you submitted it yourself."
        />
        <EmptyState
          icon={FileCheck2}
          title="No applications yet"
          description="When you mark a job as applied, the date and (once tailoring exists) the exact CV and cover letter that went to that employer are recorded here by file hash."
        >
          <Link href="/jobs" className="btn-primary">
            Go to your jobs
          </Link>
        </EmptyState>
      </>
    );
  }

  const jobsById = new Map<string, Job>(jobs.map((j) => [j.id, j]));

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every application you recorded, with the date you submitted it yourself."
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
              <th className="px-4 py-3 font-medium">Applied on</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Job status</th>
              <th className="px-4 py-3 font-medium">Documents</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app: Application) => {
              const job = jobsById.get(app.job_id);
              return (
                <tr
                  key={app.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {app.applied_on}
                  </td>
                  <td className="px-4 py-3">
                    {job ? (
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-stone-900 hover:text-accent"
                      >
                        {job.title ?? "Untitled role"}
                      </Link>
                    ) : (
                      <span className="text-stone-400">Deleted job</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {job?.company ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {job ? (
                      <span className="chip">
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">
                    {app.submitted_cv_id
                      ? "CV recorded"
                      : "Added before document tracking existed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
