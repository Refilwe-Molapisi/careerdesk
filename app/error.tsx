"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in the console for debugging, without
    // exposing internals in the interface.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-stone-900">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-stone-500">
        An unexpected error occurred. Your data is safe. Try again, and if the
        problem keeps happening, check your connection and Supabase
        configuration.
      </p>
      {error.message ? (
        <details className="max-w-md text-left">
          <summary className="cursor-pointer text-xs font-medium text-stone-500">
            Technical details
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-stone-100 p-3 text-xs text-stone-700">
            {error.message}
          </p>
          {error.digest ? (
            <p className="mt-1 text-xs text-stone-400">
              Error reference: {error.digest}
            </p>
          ) : null}
        </details>
      ) : (
        <p className="text-xs text-stone-400">Error reference: {error.digest}</p>
      )}
      <button onClick={reset} className="btn-primary">
        Try again
      </button>
    </div>
  );
}
