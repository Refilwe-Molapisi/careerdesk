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
import { QueryErrorPanel } from "@/components/ui/query-error";

export const metadata: Metadata = {
  title: "Plan",
};

export default async function PlanPage() {
  const { user, supabase } = await requireUser();

  // Surface the real database error on the page: in production React hides
  // server error messages (error #441), leaving only an opaque digest.
  const results = await Promise.allSettled([
    listHourLogs(supabase),
    listPlanItems(supabase),
    listProjects(supabase),
    listDeliverables(supabase),
    listWeeklyReviews(supabase),
  ]);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    const reason = failed.reason instanceof Error ? failed.reason.message : String(failed.reason);
    return (
      <>
        <PageHeader
          title="Plan"
          description="16 hours a week across five categories, the monthly learning topics, the six portfolio projects, and a Saturday review. Exams come first; Sunday is rest."
        />
        <QueryErrorPanel page="Plan" source="hour logs, plan items, projects or weekly reviews" message={reason} />
      </>
    );
  }
  const [logs, items, projects, deliverables, reviews] = results.map(
    (r) => (r as PromiseFulfilledResult<unknown[]>).value,
  ) as [
    Awaited<ReturnType<typeof listHourLogs>>,
    Awaited<ReturnType<typeof listPlanItems>>,
    Awaited<ReturnType<typeof listProjects>>,
    Awaited<ReturnType<typeof listDeliverables>>,
    Awaited<ReturnType<typeof listWeeklyReviews>>,
  ];

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
