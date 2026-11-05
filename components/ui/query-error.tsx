import { AlertTriangle, Database } from "lucide-react";

/**
 * Server-rendered replacement for a page whose data queries failed. React
 * hides real server error messages in production builds (React error #441),
 * so the page itself renders what actually went wrong instead of throwing.
 */
export function QueryErrorPanel({
  page,
  source,
  message,
}: {
  page: string;
  source: string;
  message: string;
}) {
  return (
    <section className="card border-amber-300 p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        {page} could not load its data
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        The database query for <span className="font-medium">{source}</span>{" "}
        failed. The message below is from Supabase and says exactly why. In
        most cases this is a missing table or column — run{" "}
        <span className="font-medium">Settings &rarr; Database check</span> for
        the full list, and paste{" "}
        <span className="font-mono text-xs">supabase/fix_now.sql</span> into
        Supabase &rarr; SQL Editor if anything is missing.
      </p>
      <pre className="mt-3 overflow-auto rounded-lg bg-stone-100 p-3 text-xs leading-relaxed text-stone-800">
        {message}
      </pre>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-400">
        <Database className="h-3.5 w-3.5" aria-hidden />
        Your data is safe: nothing was written, the read simply failed.
      </p>
    </section>
  );
}
