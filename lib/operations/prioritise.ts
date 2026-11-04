/**
 * Application prioritisation (Prompt 23). No single match score: a
 * recommendation plus a factor table with a short note each. The rules run
 * in code BEFORE any AI explanation: ineligible means do not apply unless
 * overridden with a reason; two or more essential skills marked gap means
 * develop first; an off-target role family lowers the recommendation one
 * level.
 */
import type { Job, CareerEntry } from "@/lib/data/types";
import type { Skill } from "@/lib/data/queries/skills";
import { TARGET_ROLE_FAMILIES, ROLE_FAMILY_LABELS } from "@/lib/data/types";

export type Recommendation = "apply" | "apply_with_reservations" | "develop_first" | "do_not_apply";

export type RecommendationFactor = {
  factor: string;
  value: string;
  note: string;
};

const RANK: Record<Recommendation, number> = {
  apply: 0,
  apply_with_reservations: 1,
  develop_first: 2,
  do_not_apply: 3,
};

const NEXT_WORSE: Record<Recommendation, Recommendation | null> = {
  apply: "apply_with_reservations",
  apply_with_reservations: "develop_first",
  develop_first: "do_not_apply",
  do_not_apply: null,
};

export type PrioritisationContext = {
  skills: Skill[];
  entries: CareerEntry[];
  minimumSalary: number | null;
  minimumSalaryCurrency: string | null;
};

export function computeRecommendation(
  job: Job,
  ctx: PrioritisationContext,
): { recommendation: Recommendation; factors: RecommendationFactor[] } {
  const factors: RecommendationFactor[] = [];

  // Skills alignment: required skills from extraction vs the skills table.
  const skillsByName = new Map(ctx.skills.map((s) => [s.name.toLowerCase(), s]));
  const required = job.required_skills ?? [];
  const demonstrated = required.filter((name) => {
    const skill = skillsByName.get(name.toLowerCase());
    return skill && ["working", "intermediate", "advanced", "professional"].includes(skill.proficiency);
  });
  const partial = required.filter((name) => {
    const skill = skillsByName.get(name.toLowerCase());
    return (
      skill && ["learning", "basic"].includes(skill.proficiency) && !demonstrated.includes(name)
    );
  });
  const missing = required.filter(
    (name) => !demonstrated.includes(name) && !partial.includes(name),
  );
  factors.push({
    factor: "Skills alignment",
    value:
      required.length === 0
        ? "no extracted requirements"
        : `${demonstrated.length} of ${required.length} demonstrated`,
    note:
      required.length === 0
        ? "Save the job with a description so requirements can be extracted."
        : missing.length > 0
          ? `Not in your record yet: ${missing.slice(0, 4).join(", ")}.`
          : "All required skills appear in your record.",
  });

  // Eligibility.
  factors.push({
    factor: "Eligibility",
    value: job.eligibility_status,
    note:
      job.eligibility_status === "unverified"
        ? "Run the eligibility check; remote never means global."
        : job.eligibility_status === "ineligible"
          ? "The posting excludes South African residents or requires an unavailable status."
          : job.eligibility_evidence[0]?.note || "Based on the posting text; confirm with the employer.",
  });

  // Experience requirement vs mine.
  const employmentYears = ctx.entries
    .filter((e) => e.type === "job" && e.start_date)
    .reduce((total, e) => {
      const start = new Date(e.start_date!).getTime();
      const end = e.end_date ? new Date(e.end_date).getTime() : Date.now();
      return total + Math.max(0, end - start);
    }, 0);
  const myYears = Math.round((employmentYears / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
  const wants = (job.seniority ?? "").toLowerCase();
  const wantsSenior = wants.includes("senior") || wants.includes("lead") || wants.includes("manager");
  factors.push({
    factor: "Experience requirement",
    value: job.seniority ?? "not stated",
    note: wantsSenior
      ? `The posting asks for seniority; you show about ${myYears} years of employment.`
      : `You show about ${myYears} years of employment across your entries.`,
  });

  // Qualification requirement vs mine.
  const education = ctx.entries.filter((e) => e.type === "education");
  const postingText = [
    job.description ?? "",
    job.application_instructions ?? "",
  ].join(" ").toLowerCase();
  const wantsDegree = /degree|bcom|b\.com|diploma|bachelor/.test(postingText);
  factors.push({
    factor: "Qualification requirement",
    value: wantsDegree ? "degree or diploma mentioned" : "none stated",
    note:
      education.length > 0
        ? `Your record lists ${education.length} education ${education.length === 1 ? "entry" : "entries"} (including study in progress).`
        : "No education entries yet; add them so this factor can be read.",
  });

  // Salary vs my minimum.
  if (job.salary_min !== null && ctx.minimumSalary !== null) {
    const currency = job.salary_currency ?? ctx.minimumSalaryCurrency ?? "";
    const meets = job.salary_max !== null ? job.salary_max >= ctx.minimumSalary : job.salary_min >= ctx.minimumSalary;
    factors.push({
      factor: "Salary vs my minimum",
      value: `${job.salary_min ?? "?"}${job.salary_max ? ` - ${job.salary_max}` : ""} ${currency}`.trim(),
      note: meets
        ? "Above your minimum."
        : "Below or straddling the minimum you set in Settings.",
    });
  } else {
    factors.push({
      factor: "Salary vs my minimum",
      value: job.salary_min !== null ? "posted" : "not posted",
      note:
        ctx.minimumSalary === null
          ? "Set your minimum salary in Settings to activate this factor."
          : "The posting does not state a range; ask in your pre-application email.",
    });
  }

  // Career direction.
  const onTarget = TARGET_ROLE_FAMILIES.includes(job.role_family);
  factors.push({
    factor: "Career direction",
    value: ROLE_FAMILY_LABELS[job.role_family],
    note: onTarget
      ? "One of your target role families."
      : "Off-target: mainly generic for your analytical direction.",
  });

  // Competition (only when the posting states it).
  const competitionMatch = (job.description ?? "").match(/(\d+)\+?\s*(?:applicants|candidates)/i);
  factors.push({
    factor: "Competition",
    value: competitionMatch ? `${competitionMatch[1]} stated` : "no data",
    note: competitionMatch
      ? "The posting states applicant numbers; treat them as marketing."
      : "The posting does not state applicant numbers.",
  });

  // Code rules.
  let recommendation: Recommendation;
  const essentialGaps = missing.length;
  if (job.eligibility_status === "ineligible") {
    recommendation = "do_not_apply";
  } else if (essentialGaps >= 2) {
    recommendation = "develop_first";
  } else if (job.eligibility_status === "unverified" || missing.length === 1 || !onTarget) {
    recommendation = "apply_with_reservations";
  } else {
    recommendation = "apply";
  }
  if (!onTarget && recommendation !== "do_not_apply") {
    const lowered = NEXT_WORSE[recommendation];
    if (lowered) recommendation = lowered;
  }

  return { recommendation, factors };
}

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  apply: "Apply",
  apply_with_reservations: "Apply with reservations",
  develop_first: "Develop missing skills first",
  do_not_apply: "Do not apply",
};

export function recommendationRank(job: Pick<Job, "recommendation" | "recommendation_overridden">): number {
  if (!job.recommendation) return 4;
  return RANK[job.recommendation];
}
