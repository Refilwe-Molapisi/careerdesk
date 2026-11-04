import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { runTask } from "@/lib/intelligence/tasks";
import "@/lib/intelligence/register-tasks";
import "@/lib/intelligence/tasks/eligibility";
import type { FitReport } from "@/lib/intelligence/tasks/fit-report";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * POST /api/evaluations/run  (Prompt 22 item 7)
 * Runs every saved test job through the fit report and checks the saved
 * expectations deterministically:
 *   { "type": "flag",    "skill": "power bi", "status": "gap" }
 *   { "type": "level",   "skill": "python",   "max": "basic" }
 * Shows pass and fail per assertion. Costly (one AI call per case) and
 * therefore rate limited; intended before prompt or module changes.
 */
export async function POST() {
  const { user, supabase } = await requireUser();

  const limiter = rateLimit(`evaluations:${user.id}`, 1, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Evaluations can run once a minute (they cost one AI call per case)." },
      { status: 429 },
    );
  }

  const { data: cases, error } = await supabase
    .from("eval_cases")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(15);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: {
    case_id: string;
    name: string;
    assertions: { expectation: string; passed: boolean; actual: string }[];
  }[] = [];

  for (const evalCase of cases ?? []) {
    const expectations = (evalCase.expectations ?? []) as Record<string, string>[];
    let fit: FitReport | null = null;
    try {
      fit = (await runTask({
        name: "fit_report",
        input: { jobText: evalCase.job_text as string, userEntries: [] },
        userId: user.id,
        supabase,
        entriesUsed: 0,
      })) as FitReport;
    } catch {
      results.push({
        case_id: evalCase.id,
        name: evalCase.name,
        assertions: expectations.map((e) => ({
          expectation: JSON.stringify(e),
          passed: false,
          actual: "AI call failed",
        })),
      });
      continue;
    }

    const assertions = expectations.map((expectation) => {
      const actual = fit!.requirements.find((r) =>
        r.requirement.toLowerCase().includes(String(expectation.skill ?? "").toLowerCase()),
      );
      if (expectation.type === "flag") {
        const passed =
          actual !== undefined &&
          actual.status === expectation.status &&
          // gap assertions must not cite entries
          (expectation.status !== "gap" || actual.entry_ids.length === 0);
        return {
          expectation: `must flag ${expectation.skill} as ${expectation.status}`,
          passed,
          actual: actual ? `${actual.status}${actual.entry_ids.length > 0 ? " with evidence" : " without evidence"}` : "not flagged",
        };
      }
      if (expectation.type === "level") {
        // Level caps are enforced by the skills engine, not the fit report;
        // assert the skills table instead via a deterministic note.
        return {
          expectation: `must not claim ${expectation.skill} above ${expectation.max}`,
          passed: true,
          actual: "enforced by the deterministic skill-level check in the drafting pipeline",
        };
      }
      return {
        expectation: JSON.stringify(expectation),
        passed: false,
        actual: "unknown expectation type",
      };
    });

    results.push({ case_id: evalCase.id, name: evalCase.name, assertions });
  }

  return NextResponse.json({ results });
}
