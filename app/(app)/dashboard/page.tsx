import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your job search at a glance."
      />
      <EmptyState
        icon={LayoutDashboard}
        title="Nothing to show yet"
        description="Counts per status, follow-ups due this week and stale jobs will appear here once you start saving jobs."
      />
    </>
  );
}
