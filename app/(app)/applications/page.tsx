import type { Metadata } from "next";
import { FileCheck2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = {
  title: "Applications",
};

export default async function ApplicationsPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every CV and cover letter you have actually sent, recorded by file hash."
      />
      <EmptyState
        icon={FileCheck2}
        title="No applications yet"
        description="When you mark a job as applied, the exact documents that went to that employer are recorded here."
      />
    </>
  );
}
