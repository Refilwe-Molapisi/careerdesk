import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { EvaluationsClient } from "@/components/settings/evaluations-client";

export const metadata: Metadata = {
  title: "Evaluations",
};

export default async function EvaluationsPage() {
  const { user, supabase } = await requireUser();
  const { data: cases } = await supabase
    .from("eval_cases")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(15);

  return (
    <>
      <PageHeader
        title="Evaluations"
        description="Up to 15 test jobs with expected results. Run them before any prompt or module change; a fail means the change would make the AI worse."
      />
      <EvaluationsClient userId={user.id} initialCases={(cases ?? []) as never} />
    </>
  );
}
