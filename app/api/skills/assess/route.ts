import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import {
  listSkills,
  listSkillEvidence,
  listSkillAssessments,
  insertSkillAssessments,
  decideSkillAssessment,
  updateSkill,
  type Skill,
} from "@/lib/data/queries/skills";
import {
  runSkillAssessment,
  toAssessmentRows,
} from "@/lib/intelligence/tasks/skill-assessment";
import { AiUnavailableError, AiValidationError } from "@/lib/intelligence/deepseek";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * POST /api/skills/assess  -  "Assess my skills" (Prompt 12).
 * Runs the assessment task, validates every evidence id, applies the code
 * caps, and stores everything with status "proposed" for review. It never
 * changes a skill level on its own.
 */
export async function POST() {
  const { user, supabase } = await requireUser();

  const limiter = rateLimit(`skills-assess:${user.id}`, 5, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limiter.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  try {
    const [skills, evidence, existing] = await Promise.all([
      listSkills(supabase),
      listSkillEvidence(supabase),
      listSkillAssessments(supabase),
    ]);

    const evidenceBySkill = new Map<string, typeof evidence>();
    for (const item of evidence) {
      evidenceBySkill.set(item.skill_id, [
        ...(evidenceBySkill.get(item.skill_id) ?? []),
        item,
      ]);
    }

    const proposals = await runSkillAssessment({ skills, evidenceBySkill });

    // One open proposal per skill: supersede earlier proposed ones.
    const staleIds = existing
      .filter(
        (a) =>
          a.status === "proposed" &&
          proposals.some((p) => p.skill_id === a.skill_id),
      )
      .map((a) => a.id);
    await Promise.all(
      staleIds.map((id) => decideSkillAssessment(supabase, id, "rejected", null)),
    );

    await insertSkillAssessments(supabase, toAssessmentRows(user.id, proposals));

    return NextResponse.json({ count: proposals.length });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiValidationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error(
      "skills assessment failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}

/** PUT: accept / change / reject one proposal; accepting moves the level. */
export async function PUT(request: Request) {
  const { user, supabase } = await requireUser();

  let body: { assessment_id?: unknown; decision?: unknown; decided_level?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const assessmentId =
    typeof body.assessment_id === "string" && body.assessment_id.length === 36
      ? body.assessment_id
      : null;
  const decision = body.decision as
    | "accepted"
    | "changed"
    | "rejected"
    | undefined;
  if (!assessmentId || !decision) {
    return NextResponse.json({ error: "Missing decision." }, { status: 400 });
  }

  const { listSkillAssessments: list } = await import("@/lib/data/queries/skills");
  const all = await list(supabase);
  const assessment = all.find((a) => a.id === assessmentId);
  if (!assessment || assessment.user_id !== user.id) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }
  if (assessment.status !== "proposed") {
    return NextResponse.json({ error: "Already decided." }, { status: 400 });
  }

  const decidedLevel =
    decision === "rejected"
      ? null
      : ((typeof body.decided_level === "string" ? body.decided_level : assessment.proposed_level) as Skill["proficiency"]);

  if (decidedLevel && decision !== "rejected") {
    // The DB trigger re-enforces the evidence rules on the level change.
    await updateSkill(supabase, assessment.skill_id, { proficiency: decidedLevel });
  }
  await decideSkillAssessment(supabase, assessmentId, decision, decidedLevel);

  return NextResponse.json({ ok: true });
}
