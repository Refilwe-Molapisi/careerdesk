"use client";

import { useState } from "react";
import { Bot, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import {
  CareerEntryForm,
  type CareerEntryFormValues,
} from "./career-entry-form";
import type { CareerEntryInput } from "@/lib/data/types";
import { CAREER_ENTRY_TYPE_FORM_LABELS, type CareerEntryType } from "@/lib/data/types";
import { formatDateRange } from "@/lib/utils";

type ProposalState = {
  key: string;
  values: CareerEntryFormValues;
  status: "review" | "accepted" | "discarded";
};

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (inputs: CareerEntryInput[]) => Promise<void>;
};

/**
 * CV import: paste CV text, the server proposes structured entries through
 * DeepSeek, and every proposal is accepted, edited or discarded by hand.
 * Nothing is saved automatically.
 */
export function ImportModal({ open, onClose, onSave }: ImportModalProps) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [text, setText] = useState("");
  const [proposals, setProposals] = useState<ProposalState[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep("input");
    setText("");
    setProposals([]);
    setExtractError(null);
    setEditingKey(null);
  }

  function handleClose() {
    if (extracting || saving) return;
    onClose();
    if (step === "review") reset();
  }

  async function extract() {
    if (text.trim().length < 50) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/record/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          body?.error ?? "Could not read the CV. Try again in a moment.",
        );
      }
      const incoming = (body?.proposals ?? []) as {
        type: CareerEntryType;
        title: string;
        organisation: string | null;
        start_date: string | null;
        end_date: string | null;
        description: string;
        evidence: string;
        tags: string[];
      }[];
      if (incoming.length === 0) {
        throw new Error(
          "The AI could not find any entries in that text. Try pasting a fuller CV.",
        );
      }
      setProposals(
        incoming.map((p, i) => ({
          key: `p${i}-${Date.now()}`,
          status: "review" as const,
          values: {
            type: p.type,
            title: p.title,
            organisation: p.organisation ?? "",
            start_date: p.start_date ?? "",
            end_date: p.end_date ?? "",
            currently: p.end_date === null,
            description: p.description ?? "",
            evidence: p.evidence ?? "",
            tags: p.tags ?? [],
          },
        })),
      );
      setStep("review");
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setExtracting(false);
    }
  }

  function setStatus(key: string, status: ProposalState["status"]) {
    setProposals((ps) =>
      ps.map((p) => (p.key === key ? { ...p, status, values: p.values } : p)),
    );
  }

  function updateValues(key: string, values: CareerEntryFormValues) {
    setProposals((ps) => ps.map((p) => (p.key === key ? { ...p, values } : p)));
  }

  async function saveAccepted() {
    const accepted = proposals.filter((p) => p.status === "accepted");
    if (accepted.length === 0) return;
    setSaving(true);
    try {
      await onSave(accepted.map((p) => toInput(p.values)));
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save entries.");
    } finally {
      setSaving(false);
    }
  }

  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const reviewCount = proposals.filter((p) => p.status === "review").length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      wide
      title="Import from CV"
      description="Paste your CV text. The AI proposes structured entries; you accept, edit or reject each one. Nothing is saved automatically."
    >
      {step === "input" ? (
        <div className="space-y-4">
          <textarea
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input font-mono text-xs leading-relaxed"
            placeholder="Paste the full text of your CV here..."
            aria-label="CV text"
          />
          <p className="text-xs text-stone-500">
            {text.trim().length.toLocaleString("en")} characters (minimum 50,
            maximum 30,000). Everything you paste is sent to DeepSeek for
            structuring, so remove ID numbers, addresses and anything
            confidential first.
          </p>
          {extractError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {extractError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button onClick={handleClose} className="btn-outline">
              Cancel
            </button>
            <button
              onClick={extract}
              disabled={extracting || text.trim().length < 50}
              className="btn-primary"
            >
              <Bot className="h-4 w-4" aria-hidden />
              {extracting ? "Reading your CV..." : "Propose entries"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) =>
            p.status === "discarded" ? (
              <div
                key={p.key}
                className="flex items-center justify-between rounded-lg border border-dashed border-stone-200 px-3 py-2 text-xs text-stone-400"
              >
                <span className="truncate line-through">
                  {p.values.title || "Untitled entry"} (discarded)
                </span>
                <button
                  onClick={() => setStatus(p.key, "review")}
                  className="ml-2 shrink-0 underline hover:text-stone-600"
                >
                  restore
                </button>
              </div>
            ) : editingKey === p.key ? (
              <div
                key={p.key}
                className="rounded-xl border border-stone-200 p-4"
              >
                <CareerEntryForm
                  initialValues={p.values}
                  saveLabel="Done editing"
                  onSubmit={(values) => {
                    updateValues(p.key, values);
                    setEditingKey(null);
                  }}
                  onCancel={() => setEditingKey(null)}
                />
              </div>
            ) : p.status === "accepted" ? (
              <div
                key={p.key}
                className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-emerald-900">
                    {p.values.title || "Untitled entry"}
                  </p>
                  <p className="text-xs text-emerald-700">
                    {CAREER_ENTRY_TYPE_FORM_LABELS[p.values.type]} · accepted
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setEditingKey(p.key);
                      setStatus(p.key, "review");
                    }}
                    className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100"
                    aria-label="Edit accepted entry"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    onClick={() => setStatus(p.key, "review")}
                    className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100"
                    aria-label="Undo accept"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              <div key={p.key} className="rounded-xl border border-stone-200">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {p.values.title || "Untitled entry"}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {CAREER_ENTRY_TYPE_FORM_LABELS[p.values.type]}
                      {p.values.organisation ? ` · ${p.values.organisation}` : ""}
                      {p.values.start_date || p.values.end_date
                        ? ` · ${formatDateRange(p.values.start_date, p.values.currently ? null : p.values.end_date)}`
                        : ""}
                    </p>
                    {p.values.description ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-500">
                        {p.values.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs italic text-stone-400">
                      {p.values.evidence
                        ? `Evidence: ${p.values.evidence}`
                        : "No evidence found for this entry."}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setEditingKey(p.key)}
                      className="btn-ghost"
                      aria-label={`Edit ${p.values.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      onClick={() => setStatus(p.key, "discarded")}
                      className="btn-ghost text-stone-400 hover:text-red-600"
                      aria-label={`Discard ${p.values.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="flex justify-end border-t border-stone-100 px-4 py-2.5">
                  <button
                    onClick={() => setStatus(p.key, "accepted")}
                    className="btn-outline !border-emerald-300 !text-emerald-700 hover:!bg-emerald-50"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Accept
                  </button>
                </div>
              </div>
            ),
          )}

          <div className="sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t border-stone-200 bg-surface px-5 py-3">
            <p className="text-xs text-stone-500">
              {acceptedCount} accepted, {reviewCount} to review. Nothing is
              saved until you press save.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("input")}
                className="btn-outline"
                disabled={saving}
              >
                Back
              </button>
              <button
                onClick={saveAccepted}
                disabled={saving || acceptedCount === 0}
                className="btn-primary"
              >
                {saving
                  ? "Saving..."
                  : `Save ${acceptedCount} ${acceptedCount === 1 ? "entry" : "entries"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function toInput(values: CareerEntryFormValues): CareerEntryInput {
  return {
    user_id: "", // filled by the caller
    type: values.type,
    title: values.title.trim(),
    organisation: values.organisation.trim() || null,
    start_date: values.start_date || null,
    end_date: values.currently ? null : values.end_date || null,
    description: values.description.trim() || null,
    evidence: values.evidence.trim() || null,
    tags: values.tags,
  };
}
