"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Play, Plus, X } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import { cn } from "@/lib/utils";

type EvalCase = {
  id: string;
  name: string;
  job_text: string;
  expectations: { type?: string; skill?: string; status?: string; max?: string }[];
};

type RunResult = {
  case_id: string;
  name: string;
  assertions: { expectation: string; passed: boolean; actual: string }[];
};

export function EvaluationsClient({
  userId,
  initialCases,
}: {
  userId: string;
  initialCases: EvalCase[];
}) {
  const [cases, setCases] = useState(initialCases);
  const [form, setForm] = useState({ name: "", job_text: "", expectations: "" });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    let expectations: unknown;
    try {
      expectations = JSON.parse(form.expectations || "[]");
    } catch {
      toast.error("Expectations must be a JSON array, e.g. [{\"type\":\"flag\",\"skill\":\"power bi\",\"status\":\"gap\"}].");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await createClient()
        .from("eval_cases")
        .insert({
          user_id: userId,
          name: form.name.trim() || "Test job",
          job_text: form.job_text,
          expectations,
        })
        .select();
      if (error) throw new Error(error.message);
      setCases((list) => [...list, ...(data as EvalCase[])].slice(0, 15));
      setForm({ name: "", job_text: "", expectations: "" });
      toast.success("Test case saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/evaluations/run", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Run failed.");
      setResults(payload.results as RunResult[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setBusy(false);
    }
  }

  const total = results?.flatMap((r) => r.assertions) ?? [];
  const passed = total.filter((a) => a.passed).length;

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-base font-semibold text-stone-900">Add a test job</h2>
        <form onSubmit={add} className="mt-3 space-y-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="Name, e.g. Power BI gap case"
          />
          <textarea
            rows={4}
            value={form.job_text}
            onChange={(e) => setForm({ ...form, job_text: e.target.value })}
            className="input"
            placeholder="Paste the job description..."
            required
          />
          <textarea
            rows={2}
            value={form.expectations}
            onChange={(e) => setForm({ ...form, expectations: e.target.value })}
            className="input font-mono text-xs"
            placeholder='[{"type":"flag","skill":"power bi","status":"gap"}] or [{"type":"level","skill":"python","max":"basic"}]'
          />
          <button type="submit" disabled={busy || cases.length >= 15} className="btn-outline">
            <Plus className="h-4 w-4" aria-hidden /> Save test case ({cases.length}/15)
          </button>
        </form>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">Saved cases</h2>
        <button onClick={run} disabled={busy || cases.length === 0} className="btn-primary">
          <Play className="h-4 w-4" aria-hidden />
          {busy ? "Running (one AI call per case)..." : "Run evaluations"}
        </button>
      </div>

      {results ? (
        <p
          className={cn(
            "rounded-lg px-3 py-2.5 text-sm",
            passed === total.length
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-700",
          )}
        >
          {passed} of {total.length} assertions passed.
        </p>
      ) : null}

      <ul className="space-y-2">
        {cases.map((c) => {
          const result = results?.find((r) => r.case_id === c.id);
          return (
            <li key={c.id} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-stone-900">{c.name}</span>
                <button
                  onClick={async () => {
                    await createClient().from("eval_cases").delete().eq("id", c.id);
                    setCases((list) => list.filter((x) => x.id !== c.id));
                  }}
                  className="text-xs text-stone-300 hover:text-red-600"
                  aria-label={`Delete ${c.name}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-stone-400">{c.job_text}</p>
              <ul className="mt-2 space-y-1">
                {c.expectations.map((exp, i) => {
                  const assertion = result?.assertions[i];
                  return (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      {assertion ? (
                        assertion.passed ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                        ) : (
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
                        )
                      ) : null}
                      <span className="text-stone-600">
                        {JSON.stringify(exp)}
                        {assertion ? (
                          <span className="text-stone-400"> — actual: {assertion.actual}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
