import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";

export const metadata: Metadata = {
  title: "Skills",
};

export default async function SkillsPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Skills"
        description="Skill levels come only from your evidence, never from a certificate alone."
      />
      <EmptyState
        icon={GraduationCap}
        title="Skills Intelligence comes later"
        description="This module is built after the core application flow, so your record and tracker are earning their keep first."
      />
    </>
  );
}
