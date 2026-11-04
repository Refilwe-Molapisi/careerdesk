import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { listAllDocuments } from "@/lib/data/queries/documents";
import { listJobs } from "@/lib/data/queries/jobs";
import {
  DOCUMENT_TEMPLATE_LABELS,
  JOB_STATUS_LABELS,
  type ApplicationDocument,
  type DocumentTemplate,
  type Job,
} from "@/lib/data/types";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Documents",
};

export default async function DocumentsPage() {
  const { supabase } = await requireUser();
  const [documents, jobs] = await Promise.all([
    listAllDocuments(supabase),
    listJobs(supabase),
  ]);

  const jobsById = new Map<string, Job>(jobs.map((j) => [j.id, j]));
  const templates = new Set(
    documents.map((d) => d.template).filter(Boolean) as string[],
  );

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every CV and cover letter version, with the template it used and its current job status. Filter by template to see which version gets responses."
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Tailor an application from a job page and its CV and cover letter versions appear here, with export status and hashes."
        >
          <Link href="/jobs" className="btn-primary">
            Go to your jobs
          </Link>
        </EmptyState>
      ) : (
        <DocumentsTable
          documents={documents}
          jobsById={jobsById}
          templates={Array.from(templates) as DocumentTemplate[]}
        />
      )}
    </>
  );
}

function DocumentsTable({
  documents,
  jobsById,
  templates,
}: {
  documents: ApplicationDocument[];
  jobsById: Map<string, Job>;
  templates: DocumentTemplate[];
}) {
  return (
    <div className="space-y-3">
      {templates.length > 1 ? (
        <p className="text-xs text-stone-400">
          Templates in use:{" "}
          {templates.map((t) => DOCUMENT_TEMPLATE_LABELS[t] ?? t).join(", ")}
        </p>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Job status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">PDF</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const job = jobsById.get(doc.job_id);
              return (
                <tr
                  key={doc.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-3">
                    {job ? (
                      <Link
                        href={`/jobs/${job.id}/review?doc=${doc.id}`}
                        className="font-medium text-stone-900 hover:text-accent"
                      >
                        {job.title ?? "Untitled role"}
                      </Link>
                    ) : (
                      <span className="text-stone-400">Deleted job</span>
                    )}
                    <p className="text-xs text-stone-500">{job?.company ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">
                    {doc.kind === "cv" ? "CV" : "Cover letter"} v{doc.version}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {doc.template
                      ? (DOCUMENT_TEMPLATE_LABELS[doc.template as DocumentTemplate] ??
                        doc.template)
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        doc.status === "approved"
                          ? "chip !border-emerald-200 !bg-emerald-50 !text-emerald-700"
                          : doc.status === "superseded"
                            ? "chip !text-stone-400"
                            : "chip"
                      }
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500">
                    {job ? JOB_STATUS_LABELS[job.status] : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">
                    {formatDateTime(doc.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {doc.pdf_path ? (
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden /> Download
                      </a>
                    ) : (
                      <span className="text-xs text-stone-300">not exported</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
