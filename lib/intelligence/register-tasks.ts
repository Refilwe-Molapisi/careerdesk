import "server-only";
import { z } from "zod";
import { registerTask } from "@/lib/intelligence/tasks";
import {
  MODULE_RECRUITMENT,
  MODULE_DATA_ANALYTICS_BI,
  MODULE_EXCEL,
  MODULE_POWER_BI,
  MODULE_FINANCE_COMMERCIAL,
  MODULE_ECONOMICS_RESEARCH,
  MODULE_DOCUMENTATION,
  MODULE_COMMUNICATION,
} from "@/lib/intelligence/modules";
import { runFitReport } from "@/lib/intelligence/tasks/fit-report";
import { runDraftCv } from "@/lib/intelligence/tasks/draft-cv";
import { runDraftCoverLetter } from "@/lib/intelligence/tasks/draft-cover-letter";
import { runClaimCheck } from "@/lib/intelligence/tasks/claim-check";
import { runReviseLines } from "@/lib/intelligence/tasks/revise";
import { runSkillAssessment } from "@/lib/intelligence/tasks/skill-assessment";
import "@/lib/intelligence/tasks/eligibility";
import "@/lib/intelligence/tasks/priority";
import type { EntryText } from "@/lib/intelligence/validate";

/**
 * Registers every implemented task with the runner (Prompt 13). Tasks built
 * before the registry are wrapped as legacy so they share the ledger, the
 * logging (task name, duration, tokens - never content) and the typed error
 * surface. New tasks (from Prompt 14 on) declare their prompt in the
 * registry itself.
 */

const TAILORING_MODULES = [
  MODULE_RECRUITMENT,
  MODULE_DATA_ANALYTICS_BI,
  MODULE_EXCEL,
  MODULE_POWER_BI,
  MODULE_FINANCE_COMMERCIAL,
  MODULE_ECONOMICS_RESEARCH,
  MODULE_DOCUMENTATION,
  MODULE_COMMUNICATION,
];

registerTask({
  name: "fit_report",
  modules: [MODULE_RECRUITMENT],
  instruction: "Produce the fit report as specified by the task module.",
  schema: z.object({}).passthrough(),
  maxTokens: 3000,
  temperature: 0.2,
  essential: true,
  buildUser: () => "",
  legacy: (input) => runFitReport((input as { jobText: string; userEntries: EntryText[] }).jobText, (input as { jobText: string; userEntries: EntryText[] }).userEntries),
});

registerTask({
  name: "draft_cv",
  modules: TAILORING_MODULES,
  instruction: "Draft the CV as specified by the task module.",
  schema: z.object({}).passthrough(),
  maxTokens: 3500,
  temperature: 0.3,
  essential: true,
  buildUser: () => "",
  legacy: (input) => {
    const args = input as Parameters<typeof runDraftCv>[0];
    return runDraftCv(args);
  },
});

registerTask({
  name: "draft_cover_letter",
  modules: [MODULE_RECRUITMENT, MODULE_DOCUMENTATION],
  instruction: "Draft the cover letter as specified by the task module.",
  schema: z.object({}).passthrough(),
  maxTokens: 1500,
  temperature: 0.4,
  essential: true,
  buildUser: () => "",
  legacy: (input) => {
    const args = input as Parameters<typeof runDraftCoverLetter>[0];
    return runDraftCoverLetter(args);
  },
});

registerTask({
  name: "claim_check",
  modules: [],
  instruction: "Run the claim check as specified by the task module.",
  schema: z.object({}).passthrough(),
  maxTokens: 2000,
  temperature: 0.2,
  essential: true,
  buildUser: () => "",
  legacy: (input) => {
    const [lines, entriesById] = input as Parameters<typeof runClaimCheck>;
    return runClaimCheck(lines, entriesById);
  },
});

registerTask({
  name: "revise_lines",
  modules: TAILORING_MODULES,
  instruction: "Revise the requested part as specified by the task module.",
  schema: z.object({}).passthrough(),
  maxTokens: 1500,
  temperature: 0.4,
  essential: true,
  buildUser: () => "",
  legacy: (input) => {
    const args = input as Parameters<typeof runReviseLines>[0];
    return runReviseLines(args);
  },
});

registerTask({
  name: "skill_assessment",
  modules: [MODULE_RECRUITMENT],
  instruction: "Assess the skills as specified by the task module.",
  schema: z.object({}).passthrough(),
  maxTokens: 2500,
  temperature: 0.2,
  essential: true,
  buildUser: () => "",
  legacy: (input) => {
    const args = input as Parameters<typeof runSkillAssessment>[0];
    return runSkillAssessment(args);
  },
});
