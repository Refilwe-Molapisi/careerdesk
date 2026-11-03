import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import {
  listCareerEntries,
  listVoiceSamples,
} from "@/lib/data/queries/career";
import { RecordView } from "@/components/record/record-view";

export const metadata: Metadata = {
  title: "Career Record",
};

export default async function CareerRecordPage() {
  const { user, supabase } = await requireUser();

  const [entries, voiceSamples] = await Promise.all([
    listCareerEntries(supabase),
    listVoiceSamples(supabase),
  ]);

  return (
    <>
      <PageHeader
        title="Career Record"
        description="Your single source of truth: every CV line the AI writes must come from here, backed by evidence."
      />
      <RecordView userId={user.id} entries={entries} voiceSamples={voiceSamples} />
    </>
  );
}
