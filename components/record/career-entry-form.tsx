"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  CAREER_ENTRY_TYPES,
  CAREER_ENTRY_TYPE_FORM_LABELS,
  type CareerEntryType,
} from "@/lib/data/types";

export type CareerEntryFormValues = {
  type: CareerEntryType;
  title: string;
  organisation: string;
  start_date: string;
  end_date: string;
  currently: boolean;
  description: string;
  evidence: string;
  tags: string[];
};

export function emptyEntryValues(type: CareerEntryType = "job"): CareerEntryFormValues {
  return {
    type,
    title: "",
    organisation: "",
    start_date: "",
    end_date: "",
    currently: false,
    description: "",
    evidence: "",
    tags: [],
  };
}

type CareerEntryFormProps = {
  initialValues: CareerEntryFormValues;
  saveLabel: string;
  saving?: boolean;
  error?: string | null;
  onSubmit: (values: CareerEntryFormValues) => void;
  onCancel?: () => void;
};

/**
 * Add/edit form for a career entry. Evidence is required in practice: the
 * first submit with empty evidence shows a warning and turns the save button
 * into an explicit "save anyway" action (two-step confirmation).
 */
export function CareerEntryForm({
  initialValues,
  saveLabel,
  saving,
  error,
  onSubmit,
  onCancel,
}: CareerEntryFormProps) {
  const [values, setValues] = useState<CareerEntryFormValues>(initialValues);
  const [tagDraft, setTagDraft] = useState("");
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  function set<K extends keyof CareerEntryFormValues>(
    key: K,
    value: CareerEntryFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/,\s*$/, "");
    if (!tag) return;
    setValues((v) =>
      v.tags.includes(tag) || v.tags.length >= 12
        ? v
        : { ...v, tags: [...v.tags, tag] },
    );
    setTagDraft("");
  }

  function handleTagsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && tagDraft === "") {
      setValues((v) => ({ ...v, tags: v.tags.slice(0, -1) }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!values.title.trim()) return;
    if (values.start_date && values.end_date && !values.currently) {
      if (values.end_date < values.start_date) {
        setDateError("End date cannot be before the start date.");
        return;
      }
    }
    setDateError(null);

    // Two-step guard for missing evidence.
    if (!values.evidence.trim() && !evidenceConfirmed) {
      setEvidenceConfirmed(true);
      return;
    }

    onSubmit(values);
  }

  const evidenceWarning = useMemo(
    () => !values.evidence.trim() && evidenceConfirmed,
    [values.evidence, evidenceConfirmed],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="entry-type" className="label">
            Type
          </label>
          <select
            id="entry-type"
            value={values.type}
            onChange={(e) => set("type", e.target.value as CareerEntryType)}
            className="input"
          >
            {CAREER_ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {CAREER_ENTRY_TYPE_FORM_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="entry-title" className="label">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="entry-title"
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            className="input"
            placeholder="e.g. BCom Economics, or Finance assistant"
          />
        </div>
      </div>

      <div>
        <label htmlFor="entry-organisation" className="label">
          Organisation
        </label>
        <input
          id="entry-organisation"
          value={values.organisation}
          onChange={(e) => set("organisation", e.target.value)}
          className="input"
          placeholder="Employer, university or project name"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="entry-start" className="label">
            Start date
          </label>
          <input
            id="entry-start"
            type="date"
            value={values.start_date}
            onChange={(e) => set("start_date", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="entry-end" className="label">
            End date
          </label>
          <input
            id="entry-end"
            type="date"
            value={values.currently ? "" : values.end_date}
            disabled={values.currently}
            onChange={(e) => set("end_date", e.target.value)}
            className="input disabled:bg-stone-100"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={values.currently}
              onChange={(e) => {
                set("currently", e.target.checked);
                if (e.target.checked) set("end_date", "");
              }}
              className="h-4 w-4 rounded border-stone-300 text-accent focus:ring-accent"
            />
            Current (no end date)
          </label>
        </div>
      </div>

      {dateError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {dateError}
        </p>
      ) : null}

      <div>
        <label htmlFor="entry-description" className="label">
          Description
        </label>
        <textarea
          id="entry-description"
          rows={3}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className="input"
          placeholder="What you did, in plain sentences. Numbers and named tools help."
        />
      </div>

      <div>
        <label htmlFor="entry-evidence" className="label">
          Evidence <span className="text-stone-400">(what you can show)</span>
        </label>
        <textarea
          id="entry-evidence"
          rows={2}
          value={values.evidence}
          onChange={(e) => set("evidence", e.target.value)}
          className="input"
          placeholder="A number, a link, a file, or a plain statement of what you can show."
        />
        {evidenceWarning ? (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            This entry has no evidence. Every CV line the AI writes must come
            from the record, so entries without evidence stay weak. You can
            still save it with the button below.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="entry-tags" className="label">
          Tags
        </label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          {values.tags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
              <button
                type="button"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    tags: v.tags.filter((t) => t !== tag),
                  }))
                }
                className="text-stone-400 hover:text-stone-700"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id="entry-tags"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={handleTagsKeyDown}
            onBlur={() => addTag(tagDraft)}
            className="min-w-24 flex-1 border-0 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
            placeholder={values.tags.length === 0 ? "Type a tag, press Enter" : ""}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn-outline">
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className={evidenceWarning ? "btn-danger" : "btn-primary"}
        >
          {saving
            ? "Saving..."
            : evidenceWarning
              ? "Save anyway (no evidence)"
              : saveLabel}
        </button>
      </div>
    </form>
  );
}
