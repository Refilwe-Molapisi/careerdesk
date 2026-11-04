import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { getUserSettings } from "@/lib/data/queries/career";
import { computeStyleStats } from "@/lib/operations/quality";
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

  const [entries, voiceSamples, settings] = await Promise.all([
    listCareerEntries(supabase),
    listVoiceSamples(supabase),
    getUserSettings(supabase, user.id).catch(() => null),
  ]);
  const styleStats = computeStyleStats(
    voiceSamples.map((s) => s.content).join("\n\n"),
    settings?.banned_phrases ?? [],
  );

  return (
    <>
      <PageHeader
        title="Career Record"
        description="Your single source of truth: every CV line the AI writes must come from here, backed by evidence."
      />
      <p className="-mt-2 mb-4 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
        Voice style, measured across your {voiceSamples.length} sample
        {voiceSamples.length === 1 ? "" : "s"}: {styleStats.sentences}{" "}
        sentences, average length {styleStats.avgSentenceLength} words,{" "}
        passive-voice rate {styleStats.passiveRate}%,
        banned phrases found:{" "}
        {styleStats.bannedFound.length > 0
          ? styleStats.bannedFound.join(", ")
          : "none"}
        . These are numbers, not a verdict.
      </p>
      <RecordView userId={user.id} entries={entries} voiceSamples={voiceSamples} />
    </>
  );
}
