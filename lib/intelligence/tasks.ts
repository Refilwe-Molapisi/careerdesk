import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { CORE_PROMPT } from "@/lib/intelligence/core";
import {
  chatJson,
  AiValidationError,
  takeLastUsage,
} from "@/lib/intelligence/deepseek";

/**
 * Task registry and runner (Prompt 13, lean scope: core prompt and task
 * runner). Every task declares its specialist modules, its instruction, its
 * input builder and a zod output schema. The runner:
 *   - assembles the prompt as core + the task's modules + structured data,
 *   - calls DeepSeek and validates the JSON against the schema,
 *   - retries once on validation failure,
 *   - returns a typed error otherwise,
 *   - logs task name, duration and token use (never prompt content) and
 *     writes the ai_usage ledger row,
 *   - enforces "cite only ids that were in the data" via the task schema and
 *     the per-task id validation (validate.ts / task code).
 *
 * Tasks still to register as their prompts arrive (spec list): skill_gap,
 * outcome_analysis, interview_prep, interview_live_interpret,
 * interview_live_answer, interview_feedback, interview_report,
 * project_review, tutor.
 */

export type TaskName =
  | "fit_report"
  | "draft_cv"
  | "draft_cover_letter"
  | "claim_check"
  | "revise_lines"
  | "skill_assessment"
  | "eligibility_check"
  | "priority_explanation";

type TaskDef<TSchema extends z.ZodTypeAny> = {
  name: TaskName;
  modules: string[];
  instruction: string;
  schema: TSchema;
  maxTokens: number;
  temperature: number;
  /** Essential tasks stay available at the hard spending stop. */
  essential: boolean;
  buildUser: (input: unknown) => string;
  /**
   * Legacy tasks (built before the registry) keep their own prompt builders;
   * they are registered here so every task shares the runner's logging,
   * ledger and error surface.
   */
  legacy?: (input: unknown, ctx: { supabase: SupabaseClient; userId: string }) => Promise<unknown>;
};

const REGISTRY = new Map<string, TaskDef<z.ZodTypeAny>>();

export function registerTask<T extends z.ZodTypeAny>(def: TaskDef<T>): void {
  REGISTRY.set(def.name, def as unknown as TaskDef<z.ZodTypeAny>);
}

export function getTask(name: TaskName): TaskDef<z.ZodTypeAny> | undefined {
  return REGISTRY.get(name);
}

export class TaskNotRegisteredError extends Error {
  constructor(name: string) {
    super(`Task ${name} is not registered yet.`);
    this.name = "TaskNotRegisteredError";
  }
}

export class SpendCapReachedError extends Error {
  constructor(message = "The monthly AI spending cap is reached. Raise it in Settings or wait for next month.") {
    super(message);
    this.name = "SpendCapReachedError";
  }
}

/** Rough cost in USD for the ledger; DeepSeek pricing is the owner's to
 *  refine in Settings. DeepSeek-chat is about $0.27/M in, $1.10/M out. */
function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 0.27 + (outputTokens / 1_000_000) * 1.1;
}

async function ledger(
  supabase: SupabaseClient,
  userId: string,
  row: {
    task: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    status: "ok" | "failed";
    retry_count: number;
    estimated_cost: number;
    entries_used?: number | null;
  },
): Promise<void> {
  await supabase.from("ai_usage").insert({
    user_id: userId,
    provider: "deepseek",
    ...row,
  });
}

/**
 * Runs a registered task. Legacy tasks delegate to their registered run
 * function; registry-native tasks are built, called, validated and retried
 * here once on validation failure.
 */
export async function runTask<T = unknown>({
  name,
  input,
  userId,
  supabase,
  entriesUsed = null,
}: {
  name: TaskName;
  input: unknown;
  userId: string;
  supabase: SupabaseClient;
  entriesUsed?: number | null;
}): Promise<T> {
  const def = REGISTRY.get(name);
  if (!def) throw new TaskNotRegisteredError(name);

  const started = Date.now();

  // The owner's confirmed rules join the core prompt (Prompt 22 item 6).
  const { data: rules } = await supabase
    .from("prompt_rules")
    .select("rule_text")
    .eq("active", true);
  const userRules = (rules ?? []).map((r) => r.rule_text as string);

  if (def.legacy) {
    try {
      const result = (await def.legacy(input, { supabase, userId })) as T;
      const durationMs = Date.now() - started;
      // Legacy paths record usage through the shared chatJson hook; the
      // runner turns it into the ledger row.
      const usage = takeLastUsage();
      const cost = estimateCost(usage.prompt_tokens, usage.completion_tokens);
      console.log(JSON.stringify({
        kind: "ai_task", task: name, status: "ok", duration_ms: durationMs,
        in_tokens: usage.prompt_tokens, out_tokens: usage.completion_tokens,
        entries_used: entriesUsed,
      }));
      await ledger(supabase, userId, {
        task: name,
        model: usage.model || process.env.DEEPSEEK_MODEL || "deepseek-chat",
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        status: "ok",
        retry_count: 0,
        estimated_cost: cost,
        entries_used: entriesUsed,
      });
      return result;
    } catch (err) {
      const usage = takeLastUsage();
      console.log(JSON.stringify({
        kind: "ai_task", task: name, status: "failed",
        duration_ms: Date.now() - started, entries_used: entriesUsed,
      }));
      await ledger(supabase, userId, {
        task: name,
        model: usage.model || process.env.DEEPSEEK_MODEL || "deepseek-chat",
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        status: "failed",
        retry_count: 0,
        estimated_cost: estimateCost(usage.prompt_tokens, usage.completion_tokens),
        entries_used: entriesUsed,
      });
      throw err;
    }
  }

  const retries = 0;
  let parsed: T | null = null;
  let lastError: z.ZodError | null = null;
  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let model = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await chatJson({
        system: [
          CORE_PROMPT,
          ...def.modules,
          "",
          def.instruction,
          ...(userRules.length > 0
            ? ["", "ADDITIONAL RULES FROM THE OWNER:", ...userRules.map((r) => `- ${r}`)]
            : []),
        ].join("\n"),
        user: def.buildUser(input),
        schema: def.schema,
        maxTokens: def.maxTokens,
        temperature: def.temperature,
        retryHint:
          attempt > 0 && lastError
            ? `Your previous reply failed schema validation: ${lastError.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Fix exactly that and return the JSON object again.`
            : undefined,
        onUsage: (u, m) => {
          usage = u;
          model = m;
        },
      });
      parsed = result as T;
      break;
    } catch (err) {
      if (err instanceof AiValidationError) {
        lastError = err.raw as z.ZodError;
        if (attempt === 0) {
          continue;
        }
        await ledger(supabase, userId, {
          task: name,
          model,
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          status: "failed",
          retry_count: retries,
          estimated_cost: estimateCost(usage.prompt_tokens, usage.completion_tokens),
          entries_used: entriesUsed,
        });
        console.log(JSON.stringify({
          kind: "ai_task", task: name, status: "validation_failed",
          duration_ms: Date.now() - started, retries,
        }));
        throw err;
      }
      throw err;
    }
  }

  const durationMs = Date.now() - started;
  const cost = estimateCost(usage.prompt_tokens, usage.completion_tokens);
  await ledger(supabase, userId, {
    task: name,
    model,
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    status: "ok",
    retry_count: retries,
    estimated_cost: cost,
    entries_used: entriesUsed,
  });
  // Log task name, duration and token use - never prompt content.
  console.log(JSON.stringify({
    kind: "ai_task", task: name, status: "ok",
    duration_ms: durationMs, in_tokens: usage.prompt_tokens,
    out_tokens: usage.completion_tokens, entries_used: entriesUsed,
  }));

  if (parsed === null) {
    throw new AiValidationError();
  }
  return parsed;
}
