import { AlertTriangle, CheckCircle2, Database, FileWarning } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA_EXPECTATIONS } from "@/lib/data/schema-expectations";
import { CopySqlButton } from "./copy-sql-button";

type Db = SupabaseClient<any, "public", any>;

type Problem = {
  table: string;
  missingTable: boolean;
  missingColumns: string[];
  migration: string;
  detail: string;
};

function isMissingRelation(message: string): boolean {
  return /schema cache|does not exist|Could not find the table/i.test(message);
}

/**
 * Server-rendered diagnostic: checks every table and column the migrations
 * create against the Supabase project this app is actually connected to.
 * When something is missing it names the migration file to run and shows the
 * SQL to paste (compact 0007-0011, or the full file if base tables are gone).
 */
export async function DatabaseCheckCard({ supabase }: { supabase: Db }) {
  const problems: Problem[] = [];

  await Promise.all(
    SCHEMA_EXPECTATIONS.map(async ({ table, columns, migration }) => {
      const tableRes = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (tableRes.error) {
        if (isMissingRelation(tableRes.error.message)) {
          problems.push({
            table,
            missingTable: true,
            missingColumns: [],
            migration,
            detail: tableRes.error.message,
          });
        }
        // Other errors (e.g. RLS) mean the table exists; the user's own
        // queries will surface real permission problems elsewhere.
        return;
      }

      const colRes = await supabase
        .from(table)
        .select(columns.join(", "), { count: "exact", head: true });
      if (colRes.error) {
        const missing = [...colRes.error.message.matchAll(/'(\w+)' column/g)].map(
          (m) => m[1],
        );
        problems.push({
          table,
          missingTable: false,
          missingColumns: missing,
          migration,
          detail: colRes.error.message,
        });
      }
    }),
  );

  const migrationsNeeded = [...new Set(problems.map((p) => p.migration))].sort();
  const needsFullFile = migrationsNeeded.some((m) => m < "0007");
  const sqlFile = needsFullFile
    ? "supabase/apply_all_migrations.sql"
    : "supabase/fix_now.sql";
  let sql = "";
  try {
    sql = await (
      await import("node:fs/promises")
    ).readFile(`supabase/${sqlFile.split("/").pop()}`, "utf8");
  } catch {
    sql = "";
  }

  if (problems.length === 0) {
    return (
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Database className="h-4 w-4 text-accent" aria-hidden />
          Database check
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Everything the app needs is present
          </span>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          All {SCHEMA_EXPECTATIONS.length} tables and every column they need were
          found in the connected Supabase project. If a page still shows an
          error, the cause is not a missing migration — the error itself will
          now say what failed.
        </p>
      </section>
    );
  }

  return (
    <section className="card border-amber-300 p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
        <Database className="h-4 w-4 text-accent" aria-hidden />
        Database check
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {problems.length} thing{problems.length === 1 ? "" : "s"} missing from
          your database
        </span>
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        This is why some pages crash. The Supabase project the app is connected
        to is missing the objects below. Fix: open Supabase Dashboard &rarr;{" "}
        <span className="font-medium">SQL Editor</span> &rarr; New query, paste
        the SQL from the box below and press Run.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
        {problems.map((p) => (
          <li key={`${p.table}-${p.migration}`} className="flex items-start gap-2">
            <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            <span>
              <span className="font-medium">{p.table}</span>
              {p.missingTable
                ? " — table missing"
                : ` — missing column${p.missingColumns.length === 1 ? "" : "s"}: ${p.missingColumns.join(", ") || "(see detail)"}`}
              <span className="ml-1 text-stone-400">
                (created by {p.migration})
              </span>
            </span>
          </li>
        ))}
      </ul>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          Show the SQL to paste ({sqlFile.split("/").pop()})
        </summary>
        <div className="mt-2 space-y-2">
          <CopySqlButton sql={sql} />
          <pre
            id="fix-sql-text"
            className="max-h-72 overflow-auto rounded-lg bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-100"
          >
            {sql || `Could not load ${sqlFile} — copy it from the repository instead.`}
          </pre>
        </div>
      </details>
    </section>
  );
}
