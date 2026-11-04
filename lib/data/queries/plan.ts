import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Typed queries for the Plan module: hour logs, plan items (learning topics
 * and tasks), projects with deliverables, and weekly reviews.
 */

type QueryClient = SupabaseClient;

export type HourLog = {
  id: string;
  user_id: string;
  log_date: string;
  category:
    | "technical_learning"
    | "portfolio_projects"
    | "live_platform"
    | "independent_research"
    | "career_development";
  hours: number;
  note: string | null;
};

export type PlanItem = {
  id: string;
  user_id: string;
  kind: "learning_topic" | "checklist" | "task";
  month: string | null;
  category: string | null;
  title: string;
  status: "todo" | "doing" | "done";
  due_date: string | null;
  project_id: string | null;
  notes: string | null;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  question: string | null;
  status: "planned" | "building" | "published";
  repo_url: string | null;
  page_url: string | null;
};

export type ProjectDeliverable = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  done: boolean;
  done_on: string | null;
};

export type WeeklyReview = {
  id: string;
  user_id: string;
  week_start: string;
  exam_week: boolean;
  target_hours: number | null;
  built: string | null;
  skill_shown: string | null;
  next_deliverable: string | null;
  blocked: string | null;
  protected_university: boolean | null;
  next_publish_or_apply: string | null;
  created_at: string;
};

export async function listHourLogs(client: QueryClient): Promise<HourLog[]> {
  const { data, error } = await client
    .from("hour_logs")
    .select("*")
    .order("log_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HourLog[];
}

export async function upsertHourLog(
  client: QueryClient,
  values: { user_id: string; log_date: string; category: HourLog["category"]; hours: number },
): Promise<void> {
  if (values.hours <= 0) {
    const { error } = await client
      .from("hour_logs")
      .delete()
      .match({
        user_id: values.user_id,
        log_date: values.log_date,
        category: values.category,
      });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("hour_logs").upsert(values, {
    onConflict: "user_id,log_date,category",
  });
  if (error) throw new Error(error.message);
}

export async function listPlanItems(client: QueryClient): Promise<PlanItem[]> {
  const { data, error } = await client
    .from("plan_items")
    .select("*")
    .order("month", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanItem[];
}

export async function createPlanItem(
  client: QueryClient,
  values: {
    user_id: string;
    kind: PlanItem["kind"];
    month: string | null;
    title: string;
  },
): Promise<void> {
  const { error } = await client.from("plan_items").insert(values);
  if (error) throw new Error(error.message);
}

export async function setPlanItemStatus(
  client: QueryClient,
  id: string,
  status: PlanItem["status"],
): Promise<void> {
  const { error } = await client.from("plan_items").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePlanItem(
  client: QueryClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("plan_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listProjects(client: QueryClient): Promise<Project[]> {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function listDeliverables(
  client: QueryClient,
): Promise<ProjectDeliverable[]> {
  const { data, error } = await client
    .from("project_deliverables")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectDeliverable[];
}

export async function toggleDeliverable(
  client: QueryClient,
  id: string,
  done: boolean,
): Promise<void> {
  const { error } = await client
    .from("project_deliverables")
    .update({ done, done_on: done ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** The six portfolio projects from the plan, each with its deliverables. */
export const SIX_PORTFOLIO_PROJECTS: { name: string; question: string }[] = [
  { name: "Retail sales analysis", question: "What drives revenue across regions and categories?" },
  { name: "Financial performance dashboard", question: "How does cost vs profitability move month to month?" },
  { name: "Market and competitor scan", question: "Where is the market growing and who is winning?" },
  { name: "Risk and reconciliation audit", question: "Which accounts and patterns look off?" },
  { name: "Operations efficiency review", question: "Where do volumes and turnaround times disagree?" },
  { name: "Economics brief", question: "What do the latest indicators mean for a local business?" },
];

export const PROJECT_DELIVERABLES = [
  "dataset documented",
  "SQL queries",
  "dashboard",
  "five findings",
  "README",
  "portfolio page",
];

export async function seedSixProjects(
  client: QueryClient,
  userId: string,
): Promise<void> {
  const { data, error } = await client
    .from("projects")
    .insert(
      SIX_PORTFOLIO_PROJECTS.map((p) => ({
        user_id: userId,
        name: p.name,
        question: p.question,
        status: "planned" as const,
      })),
    )
    .select();
  if (error) throw new Error(error.message);

  const deliverables = (data as Project[]).flatMap((project) =>
    PROJECT_DELIVERABLES.map((title) => ({
      user_id: userId,
      project_id: project.id,
      title,
    })),
  );
  const { error: deliverableError } = await client
    .from("project_deliverables")
    .insert(deliverables);
  if (deliverableError) throw new Error(deliverableError.message);
}

export async function listWeeklyReviews(
  client: QueryClient,
): Promise<WeeklyReview[]> {
  const { data, error } = await client
    .from("weekly_reviews")
    .select("*")
    .order("week_start", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WeeklyReview[];
}

export async function upsertWeeklyReview(
  client: QueryClient,
  values: {
    user_id: string;
    week_start: string;
    exam_week: boolean;
    built: string | null;
    skill_shown: string | null;
    next_deliverable: string | null;
    blocked: string | null;
    protected_university: boolean | null;
    next_publish_or_apply: string | null;
  },
): Promise<void> {
  const { error } = await client.from("weekly_reviews").upsert(values, {
    onConflict: "user_id,week_start",
  });
  if (error) throw new Error(error.message);
}
