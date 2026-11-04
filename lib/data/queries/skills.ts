import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Skills Intelligence queries (Prompt 12). Level rules are enforced by DB
 * triggers (migration 0007); the seed list comes from the spec.
 */

type QueryClient = SupabaseClient;

export type Skill = {
  id: string;
  user_id: string;
  name: string;
  category:
    | "technical"
    | "analytical"
    | "economics"
    | "business"
    | "research"
    | "finance"
    | "operations"
    | "communication"
    | "ai";
  proficiency:
    | "not_started"
    | "learning"
    | "basic"
    | "working"
    | "intermediate"
    | "advanced"
    | "professional";
  learning_status:
    | "not_started"
    | "learning"
    | "practising"
    | "applied"
    | "maintained";
  practical_experience: boolean;
  last_used: string | null;
  target_role_families: string[];
  notes: string | null;
  created_at: string;
};

export type SkillEvidence = {
  id: string;
  user_id: string;
  skill_id: string;
  career_entry_id: string | null;
  project_id: string | null;
  evidence_type: "employment" | "education" | "project" | "certificate" | "self_study";
  description: string;
  link: string | null;
  date: string | null;
  created_at: string;
};

export type SkillAssessment = {
  id: string;
  user_id: string;
  skill_id: string;
  proposed_level: Skill["proficiency"];
  reasoning: string;
  evidence_ids: string[];
  status: "proposed" | "accepted" | "changed" | "rejected";
  decided_level: Skill["proficiency"] | null;
  created_at: string;
  decided_at: string | null;
};

export const SKILL_CATEGORIES = [
  "technical",
  "analytical",
  "economics",
  "business",
  "research",
  "finance",
  "operations",
  "communication",
  "ai",
] as const;

export const PROFICIENCY_LEVELS = [
  "not_started",
  "learning",
  "basic",
  "working",
  "intermediate",
  "advanced",
  "professional",
] as const;

/** The spec's seed list; every skill starts at not_started. */
export const SEED_SKILLS: { name: string; category: Skill["category"] }[] = [
  { name: "Excel", category: "technical" },
  { name: "SQL", category: "technical" },
  { name: "Python", category: "technical" },
  { name: "Power BI", category: "technical" },
  { name: "data analysis", category: "analytical" },
  { name: "trend analysis", category: "analytical" },
  { name: "financial analysis", category: "finance" },
  { name: "microeconomics", category: "economics" },
  { name: "macroeconomics", category: "economics" },
  { name: "econometrics", category: "economics" },
  { name: "commercial analysis", category: "business" },
  { name: "pricing", category: "business" },
  { name: "competitor analysis", category: "research" },
  { name: "desk research", category: "research" },
  { name: "market research", category: "research" },
  { name: "report writing", category: "communication" },
  { name: "bookkeeping", category: "finance" },
  { name: "reconciliations", category: "finance" },
  { name: "financial reporting", category: "finance" },
  { name: "process improvement", category: "operations" },
  { name: "workflow management", category: "operations" },
  { name: "business writing", category: "communication" },
  { name: "presenting findings", category: "communication" },
  { name: "AI-assisted research", category: "ai" },
  { name: "prompt engineering", category: "ai" },
  { name: "AI workflow development", category: "ai" },
];

/** Seeds the spec's skill list once, on the first Skills page visit. */
export async function seedSkillsIfEmpty(
  client: QueryClient,
  userId: string,
): Promise<void> {
  const { count, error } = await client
    .from("skills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;

  const { error: insertError } = await client.from("skills").insert(
    SEED_SKILLS.map((s) => ({ user_id: userId, name: s.name, category: s.category })),
  );
  // Ignore unique violations from a concurrent seed; anything else is real.
  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }
}

export async function listSkills(client: QueryClient): Promise<Skill[]> {
  const { data, error } = await client
    .from("skills")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Skill[];
}

export async function listSkillEvidence(
  client: QueryClient,
): Promise<SkillEvidence[]> {
  const { data, error } = await client
    .from("skill_evidence")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillEvidence[];
}

export async function listSkillAssessments(
  client: QueryClient,
): Promise<SkillAssessment[]> {
  const { data, error } = await client
    .from("skill_assessments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillAssessment[];
}

export async function createSkillEvidence(
  client: QueryClient,
  values: {
    user_id: string;
    skill_id: string;
    career_entry_id?: string | null;
    project_id?: string | null;
    evidence_type: SkillEvidence["evidence_type"];
    description: string;
    link?: string | null;
    date?: string | null;
  },
): Promise<SkillEvidence> {
  const { data, error } = await client
    .from("skill_evidence")
    .insert(values)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SkillEvidence;
}

export async function deleteSkillEvidence(
  client: QueryClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("skill_evidence").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateSkill(
  client: QueryClient,
  id: string,
  values: {
    proficiency?: Skill["proficiency"];
    learning_status?: Skill["learning_status"];
    last_used?: string | null;
    target_role_families?: string[];
    notes?: string | null;
  },
): Promise<Skill> {
  const { data, error } = await client
    .from("skills")
    .update(values)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Skill;
}

export async function insertSkillAssessments(
  client: QueryClient,
  values: {
    user_id: string;
    skill_id: string;
    proposed_level: SkillAssessment["proposed_level"];
    reasoning: string;
    evidence_ids: string[];
  }[],
): Promise<void> {
  if (values.length === 0) return;
  const { error } = await client.from("skill_assessments").insert(values);
  if (error) throw new Error(error.message);
}

export async function decideSkillAssessment(
  client: QueryClient,
  id: string,
  status: "accepted" | "changed" | "rejected",
  decidedLevel: Skill["proficiency"] | null,
): Promise<void> {
  const { error } = await client
    .from("skill_assessments")
    .update({ status, decided_level: decidedLevel, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function isStale(skill: Skill, now: Date = new Date()): boolean {
  if (!skill.last_used) return false;
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return new Date(skill.last_used) < cutoff;
}
