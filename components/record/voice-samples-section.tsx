"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import {
  createVoiceSample,
  deleteVoiceSample,
} from "@/lib/data/queries/career";
import type { VoiceSample } from "@/lib/data/types";
import { formatDateTime } from "@/lib/utils";

type VoiceSamplesSectionProps = {
  userId: string;
  samples: VoiceSample[];
};

const MAX_CONTENT = 5_000;

export function VoiceSamplesSection({ userId, samples }: VoiceSamplesSectionProps) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !content.trim()) return;
    setAdding(true);
    try {
      await createVoiceSample(createClient(), {
        user_id: userId,
        label: label.trim(),
        content: content.trim(),
      });
      toast.success("Voice sample saved.");
      setLabel("");
      setContent("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await deleteVoiceSample(createClient(), id);
      toast.success("Voice sample deleted.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card p-5" aria-label="Voice samples">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-accent" aria-hidden />
        <h2 className="text-base font-semibold text-stone-900">
          Voice samples
        </h2>
        <span className="chip">{samples.length}</span>
      </div>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-500">
        Paste 5 to 10 pieces of your own writing: emails, reports, messages.
        They are used to match your tone when drafting cover letters and
        interview answers. Keep them free of anything confidential.
      </p>

      <form onSubmit={add} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_2fr]">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            className="input"
            placeholder="Label, e.g. Email to manager"
            aria-label="Voice sample label"
            maxLength={120}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={3}
            maxLength={MAX_CONTENT}
            className="input"
            placeholder="Paste the writing exactly as you wrote it..."
            aria-label="Voice sample text"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={adding} className="btn-outline">
            {adding ? "Saving..." : "Add sample"}
          </button>
        </div>
      </form>

      {samples.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {samples.map((sample) => (
            <li
              key={sample.id}
              className="rounded-lg border border-stone-100 bg-stone-50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800">
                    {sample.label}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Added {formatDateTime(sample.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => remove(sample.id)}
                  disabled={deletingId === sample.id}
                  className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Delete voice sample ${sample.label}`}
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Delete</span>
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-stone-600">
                {sample.content}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-stone-200 px-3 py-3 text-center text-xs text-stone-400">
          No voice samples yet. Without them, drafted text will still be plain
          and direct, but it will not sound like you.
        </p>
      )}
    </section>
  );
}
