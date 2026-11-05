import { Database } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Shown when a page's tables or columns are missing from the connected
 * Supabase project: the migration for this feature has not been applied.
 * Tells the owner exactly which file to run, instead of a generic crash.
 */
export function MigrationNotice({
  tables,
  migration,
}: {
  tables: string;
  migration: string;
}) {
  return (
    <>
      <PageHeader title="One setup step left" description="" />
      <div className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Database className="h-4 w-4 text-accent" aria-hidden />
          Your database is missing the tables for this page
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          The app is working, but the Supabase project it connects to has not
          had the migration <code className="rounded bg-stone-100 px-1">{migration}</code>{" "}
          applied, which creates{" "}
          <span className="font-medium text-stone-800">{tables}</span>. Run the
          files in <code className="rounded bg-stone-100 px-1">supabase/migrations/</code>{" "}
          in order in the Supabase SQL Editor (Dashboard &rarr; SQL Editor),
          or paste <code className="rounded bg-stone-100 px-1">supabase/apply_all_migrations.sql</code>{" "}
          which contains all of them and is safe to run twice.
        </p>
        <p className="mt-2 text-xs text-stone-400">
          After running the migration, reload this page. Your data is untouched.
          Settings &rarr; Database check lists anything else that is missing.
        </p>
      </div>
    </>
  );
}
