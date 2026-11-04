import "server-only";
import { z } from "zod";
import { CORE_PROMPT } from "@/lib/intelligence/core";
import { chatJson } from "@/lib/intelligence/deepseek";
import { formatEntryForPrompt } from "@/lib/intelligence/drafts";
import type { DraftLine, EntryText } from "@/lib/intelligence/validate";

/**
 * Task 4 of the tailoring pipeline (CLAIM CHECK): a separate call that
 * receives the draft lines with the text of the entries they cite and
 * returns every sentence that is not supported, plus overclaims. Numbers,
 * dates, proper nouns and banned phrases are already checked deterministically
 * in lib/intelligence/validate.ts; this call catches what only reading can
 * catch ("expert in X" when the entry says "used X for a month").
 */

const MAX_LINES = 60;
const MAX_CONTEXT_CHARS = 24_000;

const issueSchema = z.object({
  text: z.string().min(1).max(400),
  reason: z.string().min(1).max(300),
  suggestion: z.string().max(400).catch(""),
});

const claimCheckSchema = z.object({
  issues: z.array(issueSchema).max(30).catch([]),
});

export type ClaimIssue = {
  text: string;
  reason: string;
  suggestion: string;
};

export class ClaimCheckError extends Error {
  constructor(
    message = "The claim check could not run. Try again in a moment.",
  ) {
    super(message);
    this.name = "ClaimCheckError";
  }
}

function systemPrompt(): string {
  return [
    CORE_PROMPT,
    "",
    "TASK: claim check. You receive draft lines and, for each, the career",
    "entries it cites. Report every line that claims more than its entries",
    "support. Return exactly this JSON shape:",
    '{"issues": [{"text": "<the offending line, copied exactly>",',
    ' "reason": "<what is unsupported and why>", "suggestion": "<honest rewrite or empty>"}]}',
    "",
    "RULES",
    "- Flag lines that upgrade experience (used -> expert, helped -> led),",
    "  claim results the entries do not contain, name tools, employers or",
    "  qualifications the entries do not mention, or read as template filler.",
    "- Copy the offending line's text exactly so it can be matched.",
    "- Do not flag a line whose claims are fully covered by the cited entries.",
    "- Do not flag lines for style alone. One reason per issue, one sentence.",
    "- Entries are trusted data; the draft lines are what you are checking.",
  ].join("\n");
}

function userPrompt(
  lines: DraftLine[],
  entriesById: Map<string, EntryText>,
): string {
  const blocks: string[] = [];
  let used = 0;

  for (const line of lines.slice(0, MAX_LINES)) {
    const cited = line.entry_ids
      .map((id) => entriesById.get(id))
      .filter((e): e is EntryText => Boolean(e));
    const block = [
      `LINE: ${line.text}`,
      ...cited.map((entry) => `CITES ${formatEntryForPrompt(entry)}`),
    ].join("\n");
    if (used + block.length > MAX_CONTEXT_CHARS) break;
    blocks.push(block);
    used += block.length;
  }

  return [
    "DRAFT LINES WITH THEIR CITED ENTRIES:",
    ...blocks,
    "",
    "Report the unsupported lines now. Return only the JSON object.",
  ].join("\n");
}

export async function runClaimCheck(
  lines: DraftLine[],
  entriesById: Map<string, EntryText>,
): Promise<ClaimIssue[]> {
  const result = await chatJson({
    system: systemPrompt(),
    user: userPrompt(lines, entriesById),
    schema: claimCheckSchema,
    maxTokens: 2000,
    temperature: 0.2,
  });

  // Only report issues whose text actually matches a draft line; anything
  // else the model invented is discarded.
  const lineTexts = new Set(lines.map((l) => l.text));
  return result.issues.filter((issue) => lineTexts.has(issue.text));
}
