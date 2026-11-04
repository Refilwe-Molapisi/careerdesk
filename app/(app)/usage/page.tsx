import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { MigrationNotice } from "@/components/ui/migration-notice";

export const metadata: Metadata = {
  title: "Usage",
};

/**
 * Usage page (Prompt 24): monthly AI requests, tokens, estimated cost,
 * failures and retries, emails sent, and exported-PDF count. Numbers only,
 * straight from ai_usage and the applications table.
 */
export default async function UsagePage() {
  const { user, supabase } = await requireUser();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  let usage, docs;
  try {
    const result = await Promise.all([
    supabase
      .from("ai_usage")
      .select("task, provider, input_tokens, output_tokens, estimated_cost, status, retry_count, created_at")
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("application_documents")
      .select("id", { count: "exact", head: true })
      .not("pdf_path", "is", null),
    ]);
    usage = result[0];
    docs = result[1];
  } catch {
    return <MigrationNotice tables="ai_usage" migration="0008_ai_usage.sql" />;
  }

  const rows = usage.data ?? [];
  const ok = rows.filter((r) => r.status === "ok");
  const failed = rows.filter((r) => r.status === "failed");
  const inputTokens = ok.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const outputTokens = ok.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
  const cost = ok.reduce((s, r) => s + Number(r.estimated_cost ?? 0), 0);
  const retries = rows.reduce((s, r) => s + (r.retry_count ?? 0), 0);
  const emails = rows.filter((r) => r.provider === "resend").length;
  const byTask = new Map<string, number>();
  for (const r of ok) byTask.set(r.task, (byTask.get(r.task) ?? 0) + 1);

  const cards: { label: string; value: string }[] = [
    { label: "AI requests this month", value: String(rows.length) },
    { label: "Input tokens", value: inputTokens.toLocaleString("en-ZA") },
    { label: "Output tokens", value: outputTokens.toLocaleString("en-ZA") },
    { label: "Estimated cost", value: `$${cost.toFixed(4)}` },
    { label: "Failed requests", value: String(failed.length) },
    { label: "Retries", value: String(retries) },
    { label: "Emails sent", value: String(emails) },
    { label: "Exported PDFs (all time)", value: String(docs.count ?? 0) },
  ];

  return (
    <>
      <PageHeader
        title="Usage"
        description="What the AI services cost you this month, from the ledger the task runner writes. Storage usage is approximated by exported PDFs; the bucket dashboard shows exact bytes."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-[11px] uppercase tracking-wide text-stone-400">{c.label}</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-stone-900">Requests by task</h2>
        <ul className="mt-2 space-y-1 text-xs text-stone-600">
          {Array.from(byTask.entries()).map(([task, count]) => (
            <li key={task} className="flex justify-between">
              <span>{task}</span>
              <span className="font-medium">{count}</span>
            </li>
          ))}
          {byTask.size === 0 ? <li className="text-stone-400">No AI calls yet this month.</li> : null}
        </ul>
      </div>
    </>
  );
}
