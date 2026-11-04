"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import {
  createCareerEntries,
  createCareerEntry,
  deleteCareerEntry,
  updateCareerEntry,
} from "@/lib/data/queries/career";
import type {
  CareerEntry,
  CareerEntryInput,
  VoiceSample,
} from "@/lib/data/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { NotebookText } from "lucide-react";
import {
  CAREER_ENTRY_TYPES,
  CAREER_ENTRY_TYPE_LABELS,
} from "@/lib/data/types";
import { EntryCard } from "./entry-card";
import {
  CareerEntryForm,
  emptyEntryValues,
  type CareerEntryFormValues,
} from "./career-entry-form";
import { ImportModal } from "./import-modal";
import { VoiceSamplesSection } from "./voice-samples-section";

type RecordViewProps = {
  userId: string;
  entries: CareerEntry[];
  voiceSamples: VoiceSample[];
};

export function RecordView({ userId, entries, voiceSamples }: RecordViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CareerEntry | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<CareerEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesQuery =
        q === "" ||
        [entry.title, entry.organisation, entry.description, entry.evidence]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(q));
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => entry.tags.includes(tag));
      return matchesQuery && matchesTags;
    });
  }, [entries, query, selectedTags]);

  function toggleTag(tag: string) {
    setSelectedTags((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  }

  async function handleCreate(values: CareerEntryFormValues) {
    setBusy(true);
    setFormError(null);
    const input = toInput(userId, values);
    try {
      await createCareerEntry(createClient(), input);
      toast.success("Entry saved to your record.");
      setCreating(false);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(values: CareerEntryFormValues) {
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      await updateCareerEntry(createClient(), editing.id, toInput(userId, values));
      toast.success("Entry updated.");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCareerEntry(createClient(), deleting.id);
      toast.success("Entry deleted.");
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportSave(inputs: CareerEntryInput[]) {
    // ImportModal builds entries without a user; stamp the session user on
    // them here so RLS accepts the insert.
    await createCareerEntries(
      createClient(),
      inputs.map((input) => ({ ...input, user_id: userId })),
    );
    toast.success(`${inputs.length} ${inputs.length === 1 ? "entry" : "entries"} saved to your record.`);
    setImportOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9"
            placeholder="Search title, description, evidence..."
            aria-label="Search your record"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-outline">
            Import from CV
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            Add entry
          </button>
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-stone-400">Tags:</span>
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`chip transition-colors ${
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "hover:border-stone-300 hover:bg-stone-100"
                }`}
              >
                {tag}
              </button>
            );
          })}
          {selectedTags.length > 0 ? (
            <button
              onClick={() => setSelectedTags([])}
              className="ml-1 inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700"
            >
              <X className="h-3 w-3" aria-hidden /> clear
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Grouped list */}
      {entries.length === 0 ? (
        <EmptyState
          icon={NotebookText}
          title="Your record is empty"
          description="Education, jobs, projects, skills, achievements and certifications live here, each backed by evidence you can show. Every CV line the AI writes must come from this record."
        >
          <div className="flex gap-2">
            <button onClick={() => setCreating(true)} className="btn-primary">
              Add first entry
            </button>
            <button onClick={() => setImportOpen(true)} className="btn-outline">
              Import from CV
            </button>
          </div>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          description="No entries match your search or tag filters. Clear them to see everything."
        >
          <button
            onClick={() => {
              setQuery("");
              setSelectedTags([]);
            }}
            className="btn-outline"
          >
            Clear filters
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {CAREER_ENTRY_TYPES.map((type) => {
            const group = filtered.filter((e) => e.type === type);
            if (group.length === 0) return null;
            return (
              <section key={type} aria-label={CAREER_ENTRY_TYPE_LABELS[type]}>
                <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-stone-400">
                  {CAREER_ENTRY_TYPE_LABELS[type]}
                  <span className="text-xs font-normal normal-case text-stone-300">
                    {group.length}
                  </span>
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      busy={busy}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <VoiceSamplesSection userId={userId} samples={voiceSamples} />

      {/* Modals */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add career entry"
        description="This record is the single source of truth for every CV the AI writes."
      >
        <CareerEntryForm
          initialValues={emptyEntryValues()}
          saveLabel="Save entry"
          saving={busy}
          error={formError}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit career entry"
      >
        {editing ? (
          <CareerEntryForm
            key={editing.id}
            initialValues={toFormValues(editing)}
            saveLabel="Save changes"
            saving={busy}
            error={formError}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete entry?"
      >
        <p className="text-sm leading-relaxed text-stone-600">
          Delete <span className="font-medium text-stone-900">{deleting?.title}</span>{" "}
          from your record? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDeleting(null)} className="btn-outline">
            Keep it
          </button>
          <button onClick={handleDelete} disabled={busy} className="btn-danger">
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSave={handleImportSave}
      />
    </div>
  );
}

export function toFormValues(entry: CareerEntry): CareerEntryFormValues {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    organisation: entry.organisation ?? "",
    start_date: entry.start_date ?? "",
    end_date: entry.end_date ?? "",
    currently: entry.end_date === null,
    description: entry.description ?? "",
    evidence: entry.evidence ?? "",
    tags: entry.tags,
  };
}

export function toInput(
  userId: string,
  values: CareerEntryFormValues,
): CareerEntryInput {
  return {
    user_id: userId,
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
