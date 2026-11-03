import type { Metadata } from "next";
import { NotebookText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = {
  title: "Career Record",
};

export default async function CareerRecordPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Career Record"
        description="Your single source of truth. Every CV line the AI writes must come from here."
      />
      <EmptyState
        icon={NotebookText}
        title="Your record is empty"
        description="Education, jobs, projects, skills, achievements and certifications will live here, each backed by evidence you can show."
      />
    </>
  );
}
