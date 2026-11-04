import type { CareerEntry } from "@/lib/data/types";

/**
 * Server-side validation of AI drafts. The model's output is never trusted:
 * 1. every source id must exist, belong to the user and be in the allowed set
 *    for this job (checked against entries fetched from the database);
 * 2. a deterministic check re-verifies each line: every number, date and
 *    proper noun (employer, tool, qualification) in the line must appear in
 *    the text of at least one cited entry, or fall inside that entry's dates;
 * 3. banned phrases are matched deterministically.
 *
 * A line that fails is rejected; a line that still fails never reaches the
 * screen as approved text or the PDF (the caller regenerates once, then
 * leaves the line flagged; approval stays blocked while flags exist).
 */

export type ViolationReason =
  | "unknown_source"
  | "unverified_number"
  | "unverified_date"
  | "unverified_proper_noun"
  | "banned_phrase"
  | "ai_flagged"
  | "too_long";

export type Violation = {
  text: string;
  entry_ids: string[];
  reason: ViolationReason;
  detail: string;
};

/** A draft line: the text plus the career entries it claims to come from. */
export type DraftLine = { text: string; entry_ids: string[] };

export type EntryText = {
  id: string;
  title: string;
  organisation: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  evidence: string | null;
  tags: string[];
};

export function toEntryText(entry: CareerEntry): EntryText {
  return {
    id: entry.id,
    title: entry.title,
    organisation: entry.organisation,
    start_date: entry.start_date,
    end_date: entry.end_date,
    description: entry.description,
    evidence: entry.evidence,
    tags: entry.tags,
  };
}

/** Everything the cited entry could legitimately support. */
export function entryCorpus(entry: EntryText): string {
  return [
    entry.title,
    entry.organisation,
    entry.description,
    entry.evidence,
    entry.tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normaliseNumber(token: string): string {
  return token.replace(/[,\s]/g, "");
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/\d[\d.,]*\d|\d/g) ?? [];
  return Array.from(new Set(matches.map(normaliseNumber))).filter(
    (n) => n !== "",
  );
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];

function extractYears(text: string): number[] {
  return Array.from(new Set((text.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number)));
}

function extractMonthNames(text: string): string[] {
  const lower = text.toLowerCase();
  return MONTHS.filter((m) => new RegExp(`\\b${m}\\b`).test(lower));
}

/** Proper-noun-looking tokens (employers, tools, qualifications). */
const PROPER_NOUN_STOPLIST = new Set([
  "i", "in", "on", "at", "for", "with", "as", "the", "this", "that",
  "these", "those", "my", "our", "a", "an", "and", "but", "to", "of",
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

function extractProperNouns(text: string): string[] {
  const tokens = text.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) ?? [];
  const found: string[] = [];
  for (const token of tokens) {
    // A token that only ever opens a sentence is not evidence of a proper
    // noun; anything capitalised mid-sentence is treated as one.
    const sentenceStartOnly = new RegExp(
      `(^|[.!?]\\s+|[,;:]\\s+)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`,
    ).test(text);
    if (sentenceStartOnly) continue;
    const words = token.toLowerCase().split(/\s+/);
    if (words.every((w) => PROPER_NOUN_STOPLIST.has(w))) continue;
    found.push(token);
  }
  return Array.from(new Set(found));
}

function entryYearRange(entry: EntryText): [number, number] | null {
  const startYear = entry.start_date ? Number(entry.start_date.slice(0, 4)) : null;
  const endYear = entry.end_date
    ? Number(entry.end_date.slice(0, 4))
    : entry.start_date
      ? new Date().getFullYear() // open-ended: the current year counts as inside
      : null;
  if (startYear === null || endYear === null) return null;
  return [startYear, endYear];
}

/**
 * Deterministic check of one line against the entries it cites. A claim
 * (number, date, proper noun) passes when at least one cited entry supports
 * it; this is what makes honest multi-citation possible.
 */
export function checkLine(
  line: DraftLine,
  entries: EntryText[],
): Violation[] {
  const violations: Violation[] = [];
  const corpora = entries.map(entryCorpus);
  const yearRanges = entries.map(entryYearRange);

  const passes = (needle: string): boolean =>
    corpora.some((corpus) => corpus.includes(needle));

  for (const number of extractNumbers(line.text)) {
    if (
      !passes(number) &&
      !passes(number.replace(/^0+/, "")) &&
      !passes(number.replace(/,$/, ""))
    ) {
      violations.push({
        text: line.text,
        entry_ids: line.entry_ids,
        reason: "unverified_number",
        detail: `The number ${number} does not appear in any cited entry.`,
      });
    }
  }

  for (const year of extractYears(line.text)) {
    const inRange = yearRanges.some(
      (range) => range !== null && year >= range[0] && year <= range[1],
    );
    if (!passes(String(year)) && !inRange) {
      violations.push({
        text: line.text,
        entry_ids: line.entry_ids,
        reason: "unverified_date",
        detail: `The year ${year} is not part of any cited entry.`,
      });
    }
  }

  for (const month of extractMonthNames(line.text)) {
    if (!passes(month)) {
      violations.push({
        text: line.text,
        entry_ids: line.entry_ids,
        reason: "unverified_date",
        detail: `The month "${month}" does not appear in any cited entry.`,
      });
    }
  }

  for (const noun of extractProperNouns(line.text)) {
    if (!passes(noun.toLowerCase())) {
      violations.push({
        text: line.text,
        entry_ids: line.entry_ids,
        reason: "unverified_proper_noun",
        detail: `"${noun}" is not mentioned in any cited entry.`,
      });
    }
  }

  return violations;
}

/** Banned-phrase matches are deterministic: no AI call needed. */
export function checkBannedPhrases(
  lines: DraftLine[],
  bannedPhrases: string[],
): Violation[] {
  const violations: Violation[] = [];
  for (const line of lines) {
    const lower = line.text.toLowerCase();
    for (const phrase of bannedPhrases) {
      const p = phrase.trim().toLowerCase();
      if (p && lower.includes(p)) {
        violations.push({
          text: line.text,
          entry_ids: line.entry_ids,
          reason: "banned_phrase",
          detail: `Contains the banned phrase "${phrase.trim()}".`,
        });
      }
    }
  }
  return violations;
}

/**
 * Validates every line of a draft. Lines citing an id that does not exist,
 * does not belong to the user, or is outside the allowed set are violations
 * and are dropped from the kept lines.
 */
export function validateDraft(
  lines: DraftLine[],
  entriesById: Map<string, EntryText>,
  allowedIds: Set<string>,
): { kept: DraftLine[]; violations: Violation[] } {
  const kept: DraftLine[] = [];
  const violations: Violation[] = [];

  for (const line of lines) {
    const validIds = line.entry_ids.filter(
      (id) => allowedIds.has(id) && entriesById.has(id),
    );

    if (line.entry_ids.length > 0 && validIds.length < line.entry_ids.length) {
      violations.push({
        text: line.text,
        entry_ids: line.entry_ids,
        reason: "unknown_source",
        detail:
          "The cited entry does not exist, does not belong to you, or was not allowed for this job.",
      });
      continue;
    }

    if (validIds.length === 0) {
      violations.push({
        text: line.text,
        entry_ids: [],
        reason: "unknown_source",
        detail: "No source entry was cited for this line.",
      });
      continue;
    }

    kept.push(line);
    violations.push(
      ...checkLine(
        { text: line.text, entry_ids: validIds },
        validIds.map((id) => entriesById.get(id)!),
      ),
    );
  }

  return { kept, violations };
}

/** Distinct texts of flagged lines, for regeneration prompts. */
export function flaggedTexts(violations: Violation[]): string[] {
  return Array.from(new Set(violations.map((v) => v.text)));
}
