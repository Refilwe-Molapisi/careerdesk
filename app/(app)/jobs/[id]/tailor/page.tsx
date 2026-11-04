import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { getJob } from "@/lib/data/queries/jobs";
import { listCareerEntries } from "@/lib/data/queries/career";
import { TailorWizard } from "@/components/jobs/tailor-wizard";

export const metadata: Metadata = {
  title: "Tailor application",
};

export default async function TailorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const job = await getJob(supabase, id);
  if (!job || job.user_id !== user.id) notFound();

  const entries = await listCareerEntries(supabase);

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
          Tailor application
        </h1>
        <p className="text-sm text-stone-500">
          {[job.title ?? "Untitled role", job.company].filter(Boolean).join(" · ")}
        </p>
      </div>
      {entries.length === 0 ? (
        <div className="card p-6 text-sm text-stone-600">
          Your Career Record is empty, so there is nothing to tailor from. Add
          entries with evidence first; every CV line must come from the record.
          <div className="mt-3">
            <Link href="/record" className="btn-primary">
              Go to your Career Record
            </Link>
          </div>
        </div>
      ) : (
        <TailorWizard job={job} entries={entries} />
      )}
    </>
  );
}
