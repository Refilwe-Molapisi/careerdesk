import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = {
  title: "Jobs",
};

export default async function JobsPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Saved vacancies move from Saved through Tailoring and Ready to Applied and beyond."
      />
      <EmptyState
        icon={Briefcase}
        title="No saved jobs yet"
        description="Paste a job link or description to save your first vacancy. Job intake arrives in the next stage of the build."
      />
    </>
  );
}
