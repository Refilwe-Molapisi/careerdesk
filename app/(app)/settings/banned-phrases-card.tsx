"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import { saveBannedPhrases } from "@/lib/data/queries/career";
import { DEFAULT_BANNED_PHRASES } from "@/lib/config";

type BannedPhrasesCardProps = {
  userId: string;
  initialPhrases: string[];
};

/**
 * Banned phrases feed the AI claim check and style rules. Changes save
 * immediately; on failure the previous list is restored.
 */
export function BannedPhrasesCard({ userId, initialPhrases }: BannedPhrasesCardProps) {
  const [phrases, setPhrases] = useState<string[]>(initialPhrases);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(next: string[]) {
    const previous = phrases;
    setPhrases(next);
    setSaving(true);
    try {
      await saveBannedPhrases(createClient(), userId, next);
    } catch (err) {
      setPhrases(previous);
      toast.error(
        err instanceof Error ? err.message : "Could not save the list.",
      );
    } finally {
      setSaving(false);
    }
  }

  function add(raw: string) {
    const phrase = raw.trim().toLowerCase().replace(/,\s*$/, "");
    if (!phrase) return;
    if (phrases.includes(phrase)) {
      toast.info("That phrase is already on the list.");
      return;
    }
    setDraft("");
    void persist([...phrases, phrase]);
  }

  function remove(phrase: string) {
    void persist(phrases.filter((p) => p !== phrase));
  }

  function resetToDefault() {
    void persist([...DEFAULT_BANNED_PHRASES]);
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-base font-semibold text-stone-900">
        Banned phrases
      </h2>
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-stone-500">
        Words that must never appear in drafted CVs, cover letters or interview
        answers. The AI checks every draft against this list; flagged lines are
        rewritten or shown to you. Changes save immediately.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {phrases.map((phrase) => (
          <span key={phrase} className="chip">
            {phrase}
            <button
              onClick={() => remove(phrase)}
              disabled={saving}
              className="text-stone-400 hover:text-red-600 disabled:opacity-50"
              aria-label={`Remove ${phrase}`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        {phrases.length === 0 ? (
          <span className="text-xs italic text-stone-400">
            List is empty: the AI will not filter any phrases.
          </span>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input sm:max-w-xs"
          placeholder="Add a phrase, e.g. thought leader"
          aria-label="Add a banned phrase"
        />
        <button type="submit" disabled={saving || !draft.trim()} className="btn-outline">
          Add
        </button>
        <button
          type="button"
          onClick={resetToDefault}
          disabled={saving}
          className="btn-ghost"
        >
          Reset to default
        </button>
      </form>
    </section>
  );
}
