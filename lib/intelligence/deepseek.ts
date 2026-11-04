import "server-only";
import { z } from "zod";

/**
 * Server-only DeepSeek client (OpenAI-compatible chat endpoint).
 * Base URL, model and key come from env vars. Timeouts, one retry, JSON-mode
 * parsing with zod validation. Never logs prompt content.
 */

const BASE_URL = () => process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const MODEL = () => process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const API_KEY = () => process.env.DEEPSEEK_API_KEY;

const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2; // one try, one retry

// Last completion's usage, readable by the task runner for the ai_usage
// ledger (the ledger rows must carry real token counts, not estimates).
let lastUsage = { prompt_tokens: 0, completion_tokens: 0 };
let lastModel = "";

export function takeLastUsage(): {
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
} {
  const snapshot = { ...lastUsage, model: lastModel };
  lastUsage = { prompt_tokens: 0, completion_tokens: 0 };
  return snapshot;
}

/** The AI service is unreachable, unconfigured or failing. */
export class AiUnavailableError extends Error {
  constructor(message = "AI is unavailable right now. Try again in a moment.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** The AI answered but the output could not be validated. */
export class AiValidationError extends Error {
  /** The raw zod error, when validation was the failure mode. */
  raw: unknown;
  constructor(
    message = "The AI returned an unexpected response. Try again in a moment.",
    raw?: unknown,
  ) {
    super(message);
    this.name = "AiValidationError";
    this.raw = raw;
  }
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  // Tolerate code fences around the JSON object.
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new AiValidationError();
  }
}

async function callChatApi(
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number,
  onUsage?: (usage: { prompt_tokens: number; completion_tokens: number }, model: string) => void,
): Promise<string> {
  if (!API_KEY()) {
    throw new AiUnavailableError(
      "AI is not configured: set DEEPSEEK_API_KEY (see .env.example).",
    );
  }

  let lastError: Error = new AiUnavailableError();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL()}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY()}`,
        },
        body: JSON.stringify({
          model: MODEL(),
          messages,
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        // 429/5xx are worth a retry; other statuses fail immediately.
        const status = res.status;
        if (attempt < MAX_ATTEMPTS && (status === 429 || status >= 500)) {
          lastError = new AiUnavailableError(
            `AI service returned ${status}. Try again in a moment.`,
          );
          continue;
        }
        throw new AiUnavailableError(
          status === 401
            ? "AI request was rejected (check DEEPSEEK_API_KEY)."
            : `AI service returned ${status}. Try again in a moment.`,
        );
      }

      const payload = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      onUsage?.(
        {
          prompt_tokens: payload.usage?.prompt_tokens ?? 0,
          completion_tokens: payload.usage?.completion_tokens ?? 0,
        },
        payload.model ?? MODEL(),
      );
      lastUsage = {
        prompt_tokens: payload.usage?.prompt_tokens ?? 0,
        completion_tokens: payload.usage?.completion_tokens ?? 0,
      };
      lastModel = payload.model ?? MODEL();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new AiValidationError();
      }
      return content;
    } catch (err) {
      if (err instanceof AiUnavailableError || err instanceof AiValidationError) {
        lastError = err;
      } else if (err instanceof Error && err.name === "AbortError") {
        lastError = new AiUnavailableError("AI request timed out. Try again.");
      } else {
        lastError = new AiUnavailableError("Could not reach the AI service.");
      }
      if (attempt >= MAX_ATTEMPTS) throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/**
 * Runs a chat completion expecting a JSON object, validates it with zod,
 * retrying once when the output fails validation.
 */
export async function chatJson<T>({
  system,
  user,
  schema,
  maxTokens = 2000,
  temperature = 0.3,
  retryHint,
  onUsage,
}: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  /** Appended on retry attempts so the model can correct its shape. */
  retryHint?: string;
  onUsage?: (usage: { prompt_tokens: number; completion_tokens: number }, model: string) => void;
}): Promise<T> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: retryHint ? `${user}\n\n${retryHint}` : user },
  ];

  let lastError: Error = new AiValidationError();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const content = await callChatApi(messages, maxTokens, temperature, onUsage);
    try {
      return schema.parse(extractJson(content));
    } catch (err) {
      if (err instanceof AiValidationError) {
        lastError = err;
      } else if (err instanceof z.ZodError) {
        lastError = new AiValidationError(undefined, err);
      } else {
        lastError = new AiValidationError();
      }
    }
  }
  throw lastError;
}
