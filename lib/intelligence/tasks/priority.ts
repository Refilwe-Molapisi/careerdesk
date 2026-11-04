import { z } from "zod";
import { registerTask } from "@/lib/intelligence/tasks";
import { MODULE_RECRUITMENT } from "@/lib/intelligence/modules";

/**
 * Task: priority_explanation (Prompt 23). Runs AFTER the deterministic
 * rules; explains the recommendation and what would change it. It never
 * produces the recommendation itself.
 */

export const prioritySchema = z.object({
  explanation: z.string().min(1).max(900),
  what_would_change: z.string().min(1).max(600),
});

export type PriorityInput = {
  jobSummary: string;
  recommendation: string;
  factors: { factor: string; value: string; note: string }[];
};

registerTask({
  name: "priority_explanation",
  modules: [MODULE_RECRUITMENT],
  instruction: [
    "TASK: explain a job recommendation that was decided by rules in code.",
    "Return exactly this JSON shape:",
    '{"explanation": "...", "what_would_change": "..."}',
    "",
    "RULES",
    "- explanation: 3-5 plain sentences in her voice, referencing the factor",
    "  table supplied. Do not relitigate the recommendation: it stands.",
    "- what_would_change: the one or two concrete things that would move the",
    "  recommendation (a skill demonstrated with evidence, an employer",
    "  confirmation on engagement, a salary answer).",
    "- Never invent facts about her record beyond the factors supplied.",
    "- The recommendation is not a score and not permission: applying stays",
    "  her decision.",
  ].join("\n"),
  schema: prioritySchema,
  maxTokens: 600,
  temperature: 0.3,
  essential: true,
  buildUser: (raw) => {
    const input = raw as PriorityInput;
    return [
      `JOB: ${input.jobSummary}`,
      `RECOMMENDATION (decided by rules, fixed): ${input.recommendation}`,
      "",
      "FACTOR TABLE:",
      ...input.factors.map((f) => `- ${f.factor}: ${f.value} (${f.note})`),
      "",
      "Write the explanation now. Return only the JSON object.",
    ].join("\n");
  },
});
