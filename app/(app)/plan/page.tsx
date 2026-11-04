import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import {
  listDeliverables,
  listHourLogs,
  listPlanItems,
  listProjects,
  listWeeklyReviews,
} from "@/lib/data/queries/plan";
import { PlanView } from "@/components/plan/plan-view";

export const metadata: Metadata = {
  title: "Plan",
};

export default async function PlanPage() {
  const { user, supabase } = await requireUser();

  const [logs, items, projects, deliverables, reviews] = await Promise.all([
    listHourLogs(supabase),
    listPlanItems(supabase),
    listProjects(supabase),
    listDeliverables(supabase),
    listWeeklyReviews(supabase),
  ]);

  return (
    <>
      <PageHeader
        title="Plan"
        description="16 hours a week across five categories, the monthly learning topics, the six portfolio projects, and a Saturday review. Exams come first; Sunday is rest."
      />
      <PlanView
        userId={user.id}
        initialLogs={logs}
        initialItems={items}
        projects={projects}
        deliverables={deliverables}
        reviews={reviews}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
