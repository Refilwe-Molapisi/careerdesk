/**
 * Pure quality helpers (Prompt 22): deterministic punctuation/length checks,
 * measurable style statistics, and the Career Record contradiction detector.
 * No AI involved - the model never marks its own work as verified.
 */
import type { CareerEntry } from "@/lib/data/types";

// ---------------------------------------------------------------------------
// 1. Deterministic punctuation and length rules for generated text
// ---------------------------------------------------------------------------

export type TextCheckViolation = { text: string; detail: string };

export function checkGeneratedText(text: string): TextCheckViolation[] {
  const violations: TextCheckViolation[] = [];
  if (text.includes("\u2014") || text.includes("\u2013")) {
    violations.push({ text, detail: "Contains an em or en dash." });
  }
  if (text.includes("!")) {
    violations.push({ text, detail: "Contains an exclamation mark." });
  }
  return violations;
}

export function checkSummaryLength(text: string, maxLines = 3): TextCheckViolation[] {
  const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
  if (lines.length > maxLines) {
    return [{ text, detail: `Summary runs to ${lines.length} lines; it must stay at ${maxLines}.` }];
  }
  return [];
}

/**
 * Skill-level cap (Prompt 22 item 1): a generated line may not present a
 * skill above the level recorded in the skills table.
 */
const LEVEL_WORDS: Record<string, number> = {
  learning: 1, basic: 2, working: 3, intermediate: 4, advanced: 5,
  expert: 5, professional: 6, specialist: 5,
};

export function checkSkillLevelClaims(
  text: string,
  skillLevels: Map<string, number>,
): TextCheckViolation[] {
  const violations: TextCheckViolation[] = [];
  const lower = text.toLowerCase();
  for (const [skill, allowed] of skillLevels) {
    const idx = lower.indexOf(skill.toLowerCase());
    if (idx === -1) continue;
    for (const [word, level] of Object.entries(LEVEL_WORDS)) {
      const pattern = new RegExp(`\\b${word}\\b[^.]{0,20}\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b|\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.]{0,20}\\b${word}\\b`, "i");
      if (level > allowed && pattern.test(text)) {
        violations.push({
          text,
          detail: `Claims ${word} ${skill}, but the skills table records level ${allowed}.`,
        });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// 2. Style statistics from the voice samples (measurable rules, no verdicts)
// ---------------------------------------------------------------------------

export type StyleStats = {
  sentences: number;
  avgSentenceLength: number;
  passiveRate: number;
  bannedFound: string[];
  topOpeners: string[];
};

export function computeStyleStats(text: string, bannedPhrases: string[] = []): StyleStats {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const avgSentenceLength =
    sentences.length > 0 ? Math.round((words.length / sentences.length) * 10) / 10 : 0;

  const passiveMatches = text.match(/\b(?:is|are|was|were|been|being)\s+\w+(?:ed|en)\b/gi) ?? [];
  const passiveRate =
    sentences.length > 0
      ? Math.round((passiveMatches.length / sentences.length) * 1000) / 10
      : 0;

  const lower = text.toLowerCase();
  const bannedFound = bannedPhrases.filter((p) => p.trim() && lower.includes(p.trim().toLowerCase()));

  const openers = new Map<string, number>();
  for (const s of sentences) {
    const first = s.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    if (first && first.length > 1) openers.set(first, (openers.get(first) ?? 0) + 1);
  }
  const topOpeners = Array.from(openers.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => `${word} (${count})`);

  return { sentences: sentences.length, avgSentenceLength, passiveRate, bannedFound, topOpeners };
}

// ---------------------------------------------------------------------------
// 3. Contradiction detector for the Career Record
// ---------------------------------------------------------------------------

export type Contradiction = {
  type: "overlapping_dates" | "conflicting_title" | "conflicting_employer_dates" | "inconsistent_figure";
  detail: string;
  entryA: { id: string | null; title: string; organisation: string | null };
  entryB: { id: string | null; title: string; organisation: string | null };
};

function rangesOverlap(
  aStart: string | null, aEnd: string | null,
  bStart: string | null, bEnd: string | null,
): boolean {
  const today = "9999-12-31";
  const aS = aStart ?? "0000-01-01";
  const aE = aEnd ?? today;
  const bS = bStart ?? "0000-01-01";
  const bE = bEnd ?? today;
  return aS <= bE && bS <= aE;
}

/**
 * Compares a proposed entry against the rest of the record and returns
 * human-readable warnings with both entries named, shown side by side in
 * the form. Saving is never blocked; the warnings are advisory.
 */
export type ProposedEntry = Pick<
  CareerEntry,
  "title" | "organisation" | "type" | "start_date" | "end_date" | "description"
> & { id: string | null };

export function detectContradictions(
  proposed: ProposedEntry,
  existing: CareerEntry[],
): Contradiction[] {
  const warnings: Contradiction[] = [];
  const snap = (e: { id: string | null; title: string; organisation: string | null }) => ({
    id: e.id, title: e.title, organisation: e.organisation,
  });

  for (const other of existing) {
    if (proposed.id && other.id === proposed.id) continue;

    // Overlapping employment dates at different organisations.
    if (
      proposed.type === "job" && other.type === "job" &&
      (proposed.organisation ?? "").toLowerCase() !== (other.organisation ?? "").toLowerCase() &&
      rangesOverlap(proposed.start_date, proposed.end_date, other.start_date, other.end_date)
    ) {
      warnings.push({
        type: "overlapping_dates",
        detail: `These two employment entries overlap in time but name different employers.`,
        entryA: snap(proposed),
        entryB: snap(other),
      });
    }

    // Conflicting titles at the same organisation during overlapping dates.
    if (
      proposed.type === "job" && other.type === "job" &&
      (proposed.organisation ?? "").toLowerCase() !== "" &&
      (proposed.organisation ?? "").toLowerCase() === (other.organisation ?? "").toLowerCase() &&
      proposed.title.toLowerCase() !== other.title.toLowerCase() &&
      rangesOverlap(proposed.start_date, proposed.end_date, other.start_date, other.end_date)
    ) {
      warnings.push({
        type: "conflicting_title",
        detail: `Two different titles at the same organisation overlap in time: "${proposed.title}" and "${other.title}".`,
        entryA: snap(proposed),
        entryB: snap(other),
      });
    }

    // The same figure claimed for achievements at different employers.
    const proposedNumbers = new Set(proposed.description?.match(/\b\d[\d,.]*\b/g) ?? []);
    const otherNumbers = other.description?.match(/\b\d[\d,.]*\b/g) ?? [];
    for (const n of otherNumbers) {
      if (
        proposedNumbers.has(n) && n.replace(/[^\d]/g, "").length >= 3 &&
        (proposed.organisation ?? "").toLowerCase() !== (other.organisation ?? "").toLowerCase()
      ) {
        warnings.push({
          type: "inconsistent_figure",
          detail: `The figure ${n} appears in entries for different employers. Check it is not the same achievement counted twice.`,
          entryA: snap(proposed),
          entryB: snap(other),
        });
        break;
      }
    }
  }
  return warnings;
}
