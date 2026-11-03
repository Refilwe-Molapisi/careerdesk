import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = {
  title: "Plan",
};

export default async function PlanPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Plan"
        description="Weekly hours, learning topics and portfolio deliverables, tracked against your targets."
      />
      <EmptyState
        icon={CalendarCheck}
        title="Plan tracker comes later"
        description="The weekly hour log, checklists and Saturday review arrive after the application flow works end to end."
      />
    </>
  );
}
