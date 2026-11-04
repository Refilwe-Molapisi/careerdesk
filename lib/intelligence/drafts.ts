import type { DraftLine, EntryText } from "@/lib/intelligence/validate";
import { entryCorpus } from "@/lib/intelligence/validate";

/**
 * Structured draft shapes shared by the tailoring tasks (Prompt 6), the
 * review screen (Prompt 7) and the PDF exporter (Prompt 8). Every content
 * line carries the career entry ids it came from.
 */

export type CvSection = {
  entry_id: string;
  heading: string;
  bullets: DraftLine[];
};

export type CvEducationItem = {
  entry_id: string;
  heading: string;
  detail: string;
};

export type CvDraft = {
  summary: DraftLine;
  skills: DraftLine[];
  experience: CvSection[];
  projects: CvSection[];
  education: CvEducationItem[];
};

export type CoverLetterDraft = {
  greeting: string;
  paragraphs: DraftLine[];
  closing: string;
};

export function cvDraftLines(draft: CvDraft): DraftLine[] {
  return [
    draft.summary,
    ...draft.skills,
    ...draft.experience.flatMap((s) => s.bullets),
    ...draft.projects.flatMap((s) => s.bullets),
    ...draft.education.map((e) => ({
      text: `${e.heading}: ${e.detail}`,
      entry_ids: [e.entry_id],
    })),
  ];
}

export function coverLetterDraftLines(draft: CoverLetterDraft): DraftLine[] {
  return draft.paragraphs;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function coverLetterWordCount(draft: CoverLetterDraft): number {
  return draft.paragraphs.reduce((n, p) => n + countWords(p.text), 0);
}

/** Renders one entry as a compact prompt block with its id for citation. */
export function formatEntryForPrompt(entry: EntryText): string {
  const dates =
    entry.start_date || entry.end_date
      ? ` (${entry.start_date ?? "?"} to ${entry.end_date ?? "present"})`
      : "";
  const parts = [
    `[entry ${entry.id}]`,
    `${entry.title}${entry.organisation ? ` - ${entry.organisation}` : ""}${dates}`,
    entry.description ? `What she did: ${entry.description}` : null,
    entry.evidence ? `Evidence: ${entry.evidence}` : null,
    entry.tags.length > 0 ? `Tags: ${entry.tags.join(", ")}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Picks the entries most relevant to the job text (keyword overlap first)
 * and caps the total prompt size. Returns them in the given order.
 */
export function selectEntriesForPrompt(
  entries: EntryText[],
  jobText: string,
  charBudget = 20_000,
): EntryText[] {
  const jobTokens = new Set(
    jobText.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [],
  );

  const scored = entries.map((entry) => {
    const tokens = entryCorpus(entry).match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [];
    let score = 0;
    for (const token of tokens) if (jobTokens.has(token)) score += 1;
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked: EntryText[] = [];
  let used = 0;
  for (const { entry } of scored) {
    const size = formatEntryForPrompt(entry).length;
    if (used + size > charBudget) continue;
    picked.push(entry);
    used += size;
  }
  return picked;
}
