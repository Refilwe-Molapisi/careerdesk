import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { getJob, updateJob } from "@/lib/data/queries/jobs";
import { listCareerEntries, getUserSettings } from "@/lib/data/queries/career";
import { listSkills } from "@/lib/data/queries/skills";
import {
  computeRecommendation,
  type Recommendation,
} from "@/lib/operations/prioritise";
import { runTask } from "@/lib/intelligence/tasks";
import "@/lib/intelligence/register-tasks";
import { AiUnavailableError } from "@/lib/intelligence/deepseek";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * POST /api/jobs/[id]/recommendation  (Prompt 23)
 * Deterministic rules first (saved as the recommendation and factor table),
 * then a short AI explanation of what the code decided and what would change
 * it. The AI never produces the recommendation. Overrides always win and
 * record a reason.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const limiter = rateLimit(`recommendation:${user.id}`, 10, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a moment." },
      { status: 429 },
    );
  }

  const job = await getJob(supabase, id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const [skills, entries, settings] = await Promise.all([
    listSkills(supabase),
    listCareerEntries(supabase),
    getUserSettings(supabase, user.id).catch(() => null),
  ]);

  const { recommendation, factors } = computeRecommendation(job, {
    skills,
    entries,
    minimumSalary: settings?.minimum_salary ?? null,
    minimumSalaryCurrency: settings?.minimum_salary_currency ?? null,
  });

  let note: string | null = null;
  try {
    const explanation = (await runTask({
      name: "priority_explanation",
      input: {
        jobSummary: `${job.title ?? "Untitled role"}${job.company ? ` at ${job.company}` : ""}`,
        recommendation,
        factors,
      },
      userId: user.id,
      supabase,
      entriesUsed: 0,
    })) as { explanation: string; what_would_change: string };
    note = `${explanation.explanation} What would change it: ${explanation.what_would_change}`;
  } catch (err) {
    // The AI explanation is optional; the code decision stands without it.
    if (!(err instanceof AiUnavailableError)) {
      console.error(
        "priority explanation failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
    note = null;
  }

  const updated = await updateJob(supabase, id, {
    recommendation,
    recommendation_factors: factors,
    recommendation_note: note,
  });

  return NextResponse.json({ job: updated });
}

/** PUT: the owner's override, which always records a reason. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  let body: { recommendation?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const allowed: Recommendation[] = [
    "apply",
    "apply_with_reservations",
    "develop_first",
    "do_not_apply",
  ];
  const recommendation = body.recommendation as Recommendation;
  if (!allowed.includes(recommendation)) {
    return NextResponse.json({ error: "Unknown recommendation." }, { status: 400 });
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : null;
  if (!reason) {
    return NextResponse.json(
      { error: "An override needs a reason, even a short one." },
      { status: 400 },
    );
  }

  const job = await getJob(supabase, id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const updated = await updateJob(supabase, id, {
    recommendation,
    recommendation_overridden: true,
    override_reason: reason,
  });
  return NextResponse.json({ job: updated });
}
