"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { CareerEntry } from "@/lib/data/types";
import { formatDateRange } from "@/lib/utils";

type EntryCardProps = {
  entry: CareerEntry;
  onEdit: (entry: CareerEntry) => void;
  onDelete: (entry: CareerEntry) => void;
  busy?: boolean;
};

export function EntryCard({ entry, onEdit, onDelete, busy }: EntryCardProps) {
  const range = formatDateRange(entry.start_date, entry.end_date);

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-stone-900">
            {entry.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-stone-500">
            {[entry.organisation, range].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onEdit(entry)}
            disabled={busy}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
            aria-label={`Edit ${entry.title}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={() => onDelete(entry)}
            disabled={busy}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label={`Delete ${entry.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {entry.description ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
          {entry.description}
        </p>
      ) : null}

      <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
          Evidence
        </p>
        {entry.evidence ? (
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-stone-600">
            {entry.evidence}
          </p>
        ) : (
          <p className="mt-0.5 text-xs italic text-amber-700">
            No evidence recorded yet.
          </p>
        )}
      </div>

      {entry.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
