import { z } from "zod";
import type {
  CoverLetterDraft,
  CvDraft,
} from "@/lib/intelligence/drafts";
import type { DraftLine } from "@/lib/intelligence/validate";

/**
 * Part descriptors for "Ask for changes" (Prompt 7): which slice of a draft
 * the server regenerates, and how the replacement lines are spliced back in.
 */

export const partSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("summary") }),
  z.object({ type: z.literal("skills") }),
  z.object({
    type: z.literal("experience_section"),
    index: z.number().int().min(0).max(9),
  }),
  z.object({
    type: z.literal("projects_section"),
    index: z.number().int().min(0).max(9),
  }),
  z.object({
    type: z.literal("education_item"),
    index: z.number().int().min(0).max(9),
  }),
  z.object({
    type: z.literal("letter_paragraph"),
    index: z.number().int().min(0).max(9),
  }),
]);

export type Part = z.infer<typeof partSchema>;

/** Light parsers for hand-edited content arriving from the client. */
const lineInput = z.object({
  text: z.string().min(1).max(1200),
  entry_ids: z.array(z.string().min(1)).max(3),
});

export const cvContentSchema = z.object({
  summary: z.object({
    text: z.string().min(1).max(2000),
    entry_ids: z.array(z.string().min(1)).max(5),
  }),
  skills: z.array(lineInput).max(12),
  experience: z
    .array(
      z.object({
        entry_id: z.string().min(1),
        heading: z.string().min(1).max(300),
        bullets: z.array(lineInput).max(8),
      }),
    )
    .max(8),
  projects: z
    .array(
      z.object({
        entry_id: z.string().min(1),
        heading: z.string().min(1).max(300),
        bullets: z.array(lineInput).max(8),
      }),
    )
    .max(8),
  education: z
    .array(
      z.object({
        entry_id: z.string().min(1),
        heading: z.string().min(1).max(300),
        detail: z.string().min(1).max(600),
      }),
    )
    .max(8),
});

export const coverLetterContentSchema = z.object({
  greeting: z.string().min(1).max(200),
  paragraphs: z.array(lineInput).max(8),
  closing: z.string().min(1).max(300),
});

/** Extracts the part's lines from a draft. */
export function extractPartLines(
  kind: "cv" | "cover_letter",
  draft: CvDraft | CoverLetterDraft,
  part: Part,
): DraftLine[] {
  if (kind === "cv") {
    const cv = draft as CvDraft;
    switch (part.type) {
      case "summary":
        return [cv.summary];
      case "skills":
        return cv.skills;
      case "experience_section":
        return cv.experience[part.index]?.bullets ?? [];
      case "projects_section":
        return cv.projects[part.index]?.bullets ?? [];
      case "education_item": {
        const item = cv.education[part.index];
        return item ? [{ text: item.detail, entry_ids: [item.entry_id] }] : [];
      }
    }
  }
  const letter = draft as CoverLetterDraft;
  if (part.type === "letter_paragraph") {
    const p = letter.paragraphs[part.index];
    return p ? [p] : [];
  }
  return [];
}

/**
 * Splices replacement lines back into the draft, returning a new draft
 * object. Single-line parts take the first replacement; the entry ids come
 * from the model but are re-validated by the caller anyway.
 */
export function splicePart(
  kind: "cv" | "cover_letter",
  draft: CvDraft | CoverLetterDraft,
  part: Part,
  replacements: DraftLine[],
): CvDraft | CoverLetterDraft {
  const first = replacements[0];

  if (kind === "cv") {
    const cv = draft as CvDraft;
    switch (part.type) {
      case "summary":
        return first ? { ...cv, summary: first } : cv;
      case "skills":
        return { ...cv, skills: replacements.slice(0, 12) };
      case "experience_section":
        return {
          ...cv,
          experience: cv.experience.map((section, i) =>
            i === part.index
              ? { ...section, bullets: replacements.slice(0, 8) }
              : section,
          ),
        };
      case "projects_section":
        return {
          ...cv,
          projects: cv.projects.map((section, i) =>
            i === part.index
              ? { ...section, bullets: replacements.slice(0, 8) }
              : section,
          ),
        };
      case "education_item":
        return {
          ...cv,
          education: cv.education.map((item, i) =>
            i === part.index && first
              ? { ...item, detail: first.text }
              : item,
          ),
        };
    }
  }

  const letter = draft as CoverLetterDraft;
  if (part.type === "letter_paragraph") {
    return {
      ...letter,
      paragraphs: letter.paragraphs.map((p, i) =>
        i === part.index && first ? first : p,
      ),
    };
  }
  return draft;
}

/** Options for the "Ask for changes" part picker in the UI. */
export function partOptions(
  kind: "cv" | "cover_letter",
  draft: CvDraft | CoverLetterDraft,
): { value: string; label: string; part: Part }[] {
  const options: { value: string; label: string; part: Part }[] = [];
  if (kind === "cv") {
    const cv = draft as CvDraft;
    options.push({ value: "summary", label: "Summary", part: { type: "summary" } });
    options.push({ value: "skills", label: "Skills", part: { type: "skills" } });
    cv.experience.forEach((section, i) =>
      options.push({
        value: `experience_section:${i}`,
        label: `Experience: ${section.heading}`,
        part: { type: "experience_section", index: i },
      }),
    );
    cv.projects.forEach((section, i) =>
      options.push({
        value: `projects_section:${i}`,
        label: `Project: ${section.heading}`,
        part: { type: "projects_section", index: i },
      }),
    );
    cv.education.forEach((item, i) =>
      options.push({
        value: `education_item:${i}`,
        label: `Education: ${item.heading}`,
        part: { type: "education_item", index: i },
      }),
    );
  } else {
    const letter = draft as CoverLetterDraft;
    letter.paragraphs.forEach((p, i) =>
      options.push({
        value: `letter_paragraph:${i}`,
        label: `Paragraph ${i + 1}`,
        part: { type: "letter_paragraph", index: i },
      }),
    );
  }
  return options;
}
