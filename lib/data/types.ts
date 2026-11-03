/** Row types matching the SQL migrations, shared across all three layers. */

export type CareerEntryType =
  | "education"
  | "job"
  | "project"
  | "skill"
  | "achievement"
  | "certification"
  | "other";

export type CareerEntry = {
  id: string;
  user_id: string;
  type: CareerEntryType;
  title: string;
  organisation: string | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD, null = present
  description: string | null;
  evidence: string | null;
  tags: string[];
  created_at: string;
};

export type CareerEntryInput = {
  user_id: string;
  type: CareerEntryType;
  title: string;
  organisation: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  evidence: string | null;
  tags: string[];
};

export type VoiceSample = {
  id: string;
  user_id: string;
  label: string;
  content: string;
  created_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  banned_phrases: string[];
  created_at: string;
};

export const CAREER_ENTRY_TYPES: CareerEntryType[] = [
  "education",
  "job",
  "project",
  "skill",
  "achievement",
  "certification",
  "other",
];

/** Group headings on the Career Record page. */
export const CAREER_ENTRY_TYPE_LABELS: Record<CareerEntryType, string> = {
  education: "Education",
  job: "Jobs",
  project: "Projects",
  skill: "Skills",
  achievement: "Achievements",
  certification: "Certifications",
  other: "Other",
};

/** Labels used inside forms (singular). */
export const CAREER_ENTRY_TYPE_FORM_LABELS: Record<CareerEntryType, string> = {
  education: "Education",
  job: "Job",
  project: "Project",
  skill: "Skill",
  achievement: "Achievement",
  certification: "Certification",
  other: "Other",
};
