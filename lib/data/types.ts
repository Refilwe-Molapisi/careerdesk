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
  full_name: string | null;
  reminder_email: string | null;
  reminders_enabled: boolean;
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

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type JobStatus =
  | "saved"
  | "tailoring"
  | "ready"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "closed";

/** Board column order. */
export const JOB_STATUSES: JobStatus[] = [
  "saved",
  "tailoring",
  "ready",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "closed",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  tailoring: "Tailoring",
  ready: "Ready",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

export type RoleFamily =
  | "bi_reporting"
  | "commercial_analysis"
  | "market_research"
  | "risk_fraud"
  | "operations_analysis"
  | "administration"
  | "other";

export const ROLE_FAMILIES: RoleFamily[] = [
  "bi_reporting",
  "commercial_analysis",
  "market_research",
  "risk_fraud",
  "operations_analysis",
  "administration",
  "other",
];

/** The first five families are the candidate's targets; the rest are off-target. */
export const TARGET_ROLE_FAMILIES: RoleFamily[] = [
  "bi_reporting",
  "commercial_analysis",
  "market_research",
  "risk_fraud",
  "operations_analysis",
];

export const ROLE_FAMILY_LABELS: Record<RoleFamily, string> = {
  bi_reporting: "BI and reporting",
  commercial_analysis: "Commercial analysis",
  market_research: "Market research",
  risk_fraud: "Risk and fraud",
  operations_analysis: "Operations analysis",
  administration: "Administration",
  other: "Other",
};

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export const WORK_MODES: WorkMode[] = ["remote", "hybrid", "onsite", "unknown"];

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  unknown: "Unknown",
};

export type Job = {
  id: string;
  user_id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  source_url: string | null;
  description: string | null;
  required_skills: string[];
  preferred_skills: string[];
  role_family: RoleFamily;
  role_family_reason: string | null;
  seniority: string | null;
  closing_date: string | null;
  application_instructions: string | null;
  date_found: string;
  status: JobStatus;
  status_updated_at: string;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
};

export type JobInput = {
  user_id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  source_url: string | null;
  description: string | null;
  required_skills: string[];
  preferred_skills: string[];
  role_family: RoleFamily;
  role_family_reason: string | null;
  seniority: string | null;
  closing_date: string | null;
  application_instructions: string | null;
};

export type StatusHistoryEntry = {
  id: string;
  user_id: string;
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  changed_at: string;
};

export type Application = {
  id: string;
  user_id: string;
  job_id: string;
  submitted_cv_id: string | null;
  submitted_cover_letter_id: string | null;
  submitted_cv_pdf_path: string | null;
  submitted_cv_sha256: string | null;
  submitted_cover_letter_pdf_path: string | null;
  submitted_cover_letter_sha256: string | null;
  applied_on: string;
  applied_manually: boolean;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
};

export type ApplicationDocument = {
  id: string;
  user_id: string;
  job_id: string;
  kind: "cv" | "cover_letter";
  version: number;
  parent_version_id: string | null;
  template: string | null;
  status: "draft" | "approved" | "superseded";
  content_json: unknown;
  source_map: unknown;
  pdf_path: string | null;
  pdf_sha256: string | null;
  approved_at: string | null;
  created_at: string;
};

export type DocumentTemplate = "bi_commercial" | "risk_research";

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  "bi_commercial",
  "risk_research",
];

export const DOCUMENT_TEMPLATE_LABELS: Record<DocumentTemplate, string> = {
  bi_commercial: "BI and commercial",
  risk_research: "Risk and research",
};
