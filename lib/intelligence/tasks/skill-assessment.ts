import "server-only";
import { z } from "zod";
import { CORE_PROMPT } from "@/lib/intelligence/core";
import { MODULE_RECRUITMENT } from "@/lib/intelligence/modules";
import { chatJson } from "@/lib/intelligence/deepseek";
import type {
  Skill,
  SkillAssessment,
  SkillEvidence,
} from "@/lib/data/queries/skills";

/**
 * Task: assess my skills (Prompt 12). The server sends each skill with its
 * evidence; the model proposes a level with reasoning and the evidence ids
 * it used. Every proposal is stored with status "proposed" and shown to the
 * user; nothing changes a level on its own. The server re-validates every
 * evidence id and re-applies the code caps.
 */

export const LEVEL_ORDER: Record<Skill["proficiency"], number> = {
  not_started: 0,
  learning: 1,
  basic: 2,
  working: 3,
  intermediate: 4,
  advanced: 5,
  professional: 6,
};

const assessmentSchema = z.object({
  assessments: z
    .array(
      z.object({
        skill_id: z.string().min(1).max(64),
        proposed_level: z.enum([
          "not_started",
          "learning",
          "basic",
          "working",
          "intermediate",
          "advanced",
          "professional",
        ]),
        reasoning: z.string().min(1).max(1000),
        evidence_ids: z.array(z.string().min(1).max(64)).max(10).catch([]),
      }),
    )
    .max(40),
});

export class SkillAssessmentError extends Error {
  constructor(
    message = "The skills assessment could not be produced. Try again in a moment.",
  ) {
    super(message);
    this.name = "SkillAssessmentError";
  }
}

/** The code cap: certificate or study evidence alone can never exceed basic. */
export function codeCapFor(evidence: SkillEvidence[]): Skill["proficiency"] {
  const practical = evidence.some(
    (e) => e.evidence_type === "employment" || e.evidence_type === "project",
  );
  if (practical) return "professional";
  const any = evidence.length > 0;
  return any ? "basic" : "learning";
}

export async function runSkillAssessment({
  skills,
  evidenceBySkill,
}: {
  skills: Skill[];
  evidenceBySkill: Map<string, SkillEvidence[]>;
}): Promise<
  {
    skill_id: string;
    proposed_level: Skill["proficiency"];
    reasoning: string;
    evidence_ids: string[];
    capped: boolean;
  }[]
> {
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const validIds = new Set(
    [...evidenceBySkill.values()].flatMap((list) => list.map((e) => e.id)),
  );

  const skillBlocks = skills
    .filter((s) => s.proficiency !== "not_started" || (evidenceBySkill.get(s.id)?.length ?? 0) > 0)
    .map((skill) => {
      const evidence = evidenceBySkill.get(skill.id) ?? [];
      return [
        `[skill ${skill.id}] ${skill.name} (${skill.category})`,
        `current level: ${skill.proficiency}, learning status: ${skill.learning_status}, last used: ${skill.last_used ?? "unknown"}`,
        ...evidence.map(
          (e) =>
            `  [evidence ${e.id}] ${e.evidence_type}: ${e.description}${e.link ? ` (link)` : ""}${e.date ? ` dated ${e.date}` : ""}`,
        ),
      ].join("\n");
    });

  const result = await chatJson({
    system: [
      CORE_PROMPT,
      MODULE_RECRUITMENT,
      "",
      "TASK: skills assessment. For each skill, propose the level her evidence actually supports.",
      "Return exactly this JSON shape:",
      '{"assessments": [{"skill_id": "...", "proposed_level": "not_started|learning|basic|working|intermediate|advanced|professional",',
      ' "reasoning": "...", "evidence_ids": ["..."]}]}',
      "",
      "RULES",
      "- Level names are plain English bands: not_started, learning, basic,",
      "  working, intermediate, advanced, professional. Do not inflate.",
      "- employment and project evidence can support any level; certificates",
      "  and self-study alone support at most basic. The server enforces this",
      "  cap after you answer.",
      "- reasoning: one or two sentences in her voice, phrased like 'Working",
      "  knowledge of Excel, supported by your employment evidence.'",
      "- evidence_ids: copy the supplied evidence ids exactly. Never invent ids.",
      "- Skip skills with no evidence and no current level.",
    ].join("\n"),
    user: [
      "SKILLS AND EVIDENCE (the only permissible ids are these):",
      ...(skillBlocks.length > 0
        ? skillBlocks
        : ["(no skills with evidence yet)"]),
      "",
      "Produce the assessments now. Return only the JSON object.",
    ].join("\n"),
    schema: assessmentSchema,
    maxTokens: 2500,
    temperature: 0.2,
  });

  return result.assessments
    .filter((a) => skillsById.has(a.skill_id))
    .map((a) => {
      const evidenceIds = a.evidence_ids.filter((id) => validIds.has(id));
      const evidence = evidenceIds.map(
        (id) =>
          [...(evidenceBySkill.values() ?? [])].flat().find((e) => e.id === id)!,
      );
      const cap = codeCapFor(evidence);
      const capped = LEVEL_ORDER[a.proposed_level] > LEVEL_ORDER[cap];
      return {
        skill_id: a.skill_id,
        proposed_level: capped
          ? cap
          : a.proposed_level,
        reasoning: capped
          ? `${a.reasoning} (Capped by the evidence rule: certificates and study alone support at most basic.)`
          : a.reasoning,
        evidence_ids: evidenceIds,
        capped,
      };
    });
}

/** Persists validated proposals as reviewable assessments (status proposed). */
export function toAssessmentRows(
  userId: string,
  proposals: Awaited<ReturnType<typeof runSkillAssessment>>,
): {
  user_id: string;
  skill_id: string;
  proposed_level: SkillAssessment["proposed_level"];
  reasoning: string;
  evidence_ids: string[];
}[] {
  return proposals.map((p) => ({
    user_id: userId,
    skill_id: p.skill_id,
    proposed_level: p.proposed_level,
    reasoning: p.reasoning,
    evidence_ids: p.evidence_ids,
  }));
}
