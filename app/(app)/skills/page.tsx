import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { listCareerEntries } from "@/lib/data/queries/career";
import {
  listSkills,
  listSkillAssessments,
  listSkillEvidence,
  seedSkillsIfEmpty,
} from "@/lib/data/queries/skills";
import { SkillsClient } from "@/components/skills/skills-client";
import { MigrationNotice } from "@/components/ui/migration-notice";

export const metadata: Metadata = {
  title: "Skills",
};

export default async function SkillsPage() {
  const { user, supabase } = await requireUser();

  let skills, evidence, assessments, entries;
  try {
    // First visit seeds the spec's skill list, all at not_started.
    await seedSkillsIfEmpty(supabase, user.id);

    [skills, evidence, assessments, entries] = await Promise.all([
      listSkills(supabase),
      listSkillEvidence(supabase),
      listSkillAssessments(supabase),
      listCareerEntries(supabase),
    ]);
  } catch {
    return <MigrationNotice tables="skills" migration="0007_skills.sql" />;
  }

  return (
    <>
      <PageHeader
        title="Skills"
        description="Your skill levels come only from your evidence. AI assessments are proposals you accept; certificates alone cap a level at basic, and intermediate or above needs employment or project evidence."
      />
      <SkillsClient
        userId={user.id}
        skills={skills}
        evidence={evidence}
        assessments={assessments}
        entries={entries}
      />
    </>
  );
}
