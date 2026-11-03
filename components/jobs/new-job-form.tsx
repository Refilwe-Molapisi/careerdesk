"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Bot, Save } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import { createJob } from "@/lib/data/queries/jobs";
import {
  JOB_STATUS_LABELS,
  ROLE_FAMILIES,
  ROLE_FAMILY_LABELS,
  TARGET_ROLE_FAMILIES,
  WORK_MODES,
  WORK_MODE_LABELS,
  type RoleFamily,
  type WorkMode,
} from "@/lib/data/types";
import type { JobExtraction } from "@/lib/intelligence/tasks/job-extract";
import { SkillsEditor } from "./skills-editor";

type Hints = {
  title: string;
  company: string;
  location: string;
  work_mode: WorkMode;
};

const EMPTY_HINTS: Hints = {
  title: "",
  company: "",
  location: "",
  work_mode: "unknown",
};

export function NewJobForm({ userId }: { userId: string }) {
  const router = useRouter();

  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [hints, setHints] = useState<Hints>(EMPTY_HINTS);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<JobExtraction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Review-step editable state
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>("unknown");
  const [roleFamily, setRoleFamily] = useState<RoleFamily>("other");
  const [roleFamilyReason, setRoleFamilyReason] = useState("");
  const [seniority, setSeniority] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [applicationInstructions, setApplicationInstructions] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);

  const onlyLink = description.trim() === "" && sourceUrl.trim() !== "";

  function loadExtractionIntoReview(e: JobExtraction) {
    setExtraction(e);
    setTitle(e.title ?? hints.title ?? "");
    setCompany(e.company ?? hints.company ?? "");
    setLocation(e.location ?? hints.location ?? "");
    setWorkMode(e.work_mode ?? hints.work_mode ?? "unknown");
    setRoleFamily(e.role_family);
    setRoleFamilyReason(e.role_family_reason ?? "");
    setSeniority(e.seniority ?? "");
    setClosingDate(e.closing_date ?? "");
    setApplicationInstructions(e.application_instructions ?? "");
    setRequiredSkills(e.required_skills);
    setPreferredSkills(e.preferred_skills);
  }

  async function extract() {
    if (onlyLink) {
      setFormError(
        "Paste the job description below. The app does not fetch or scrape links; it only stores them.",
      );
      return;
    }
    if (description.trim().length < 50) {
      setFormError("Paste a bit more of the description (at least 50 characters).");
      return;
    }
    setFormError(null);
    setExtractError(null);
    setExtracting(true);
    try {
      const res = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          hints: {
            title: hints.title || null,
            company: hints.company || null,
            location: hints.location || null,
            work_mode: hints.work_mode !== "unknown" ? hints.work_mode : null,
          },
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Extraction failed. Try again in a moment.");
      }
      loadExtractionIntoReview(body.extraction as JobExtraction);
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setExtracting(false);
    }
  }

  async function saveJob() {
    setSaving(true);
    setFormError(null);
    try {
      const job = await createJob(createClient(), {
        user_id: userId,
        title: title.trim() || null,
        company: company.trim() || null,
        location: location.trim() || null,
        work_mode: workMode,
        source_url: sourceUrl.trim() || null,
        description: description.trim() || null,
        required_skills: requiredSkills,
        preferred_skills: preferredSkills,
        role_family: roleFamily,
        role_family_reason: roleFamilyReason.trim() || null,
        seniority: seniority.trim() || null,
        closing_date: closingDate || null,
        application_instructions: applicationInstructions.trim() || null,
      });
      toast.success("Job saved.");
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the job.");
      setSaving(false);
    }
  }

  const offTarget = !TARGET_ROLE_FAMILIES.includes(roleFamily);

  return (
    <div className="space-y-6">
      {/* Step 1: intake */}
      <section className="card space-y-4 p-5">
        <div>
          <label htmlFor="job-url" className="label">
            Job link <span className="text-stone-400">(optional, stored only)</span>
          </label>
          <input
            id="job-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="input"
            placeholder="https://..."
          />
          <p className="mt-1 text-xs text-stone-400">
            The app never opens or scrapes links. If you only have a link, open
            it and paste the description here.
          </p>
        </div>

        <div>
          <label htmlFor="job-description" className="label">
            Job description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="job-description"
            rows={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input text-sm leading-relaxed"
            placeholder="Paste the full job description: responsibilities, requirements, everything."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="job-company" className="label">
              Company <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="job-company"
              value={hints.company}
              onChange={(e) => setHints((h) => ({ ...h, company: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="job-title" className="label">
              Title <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="job-title"
              value={hints.title}
              onChange={(e) => setHints((h) => ({ ...h, title: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="job-location" className="label">
              Location <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="job-location"
              value={hints.location}
              onChange={(e) => setHints((h) => ({ ...h, location: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="job-workmode" className="label">
              Work mode <span className="text-stone-400">(optional)</span>
            </label>
            <select
              id="job-workmode"
              value={hints.work_mode}
              onChange={(e) =>
                setHints((h) => ({ ...h, work_mode: e.target.value as WorkMode }))
              }
              className="input"
            >
              <option value="unknown">Unknown</option>
              {WORK_MODES.filter((m) => m !== "unknown").map((m) => (
                <option key={m} value={m}>
                  {WORK_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </p>
        ) : null}
        {extractError ? (
          <div className="space-y-2">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {extractError}
            </p>
            <p className="text-xs text-stone-500">
              You can still save the job with the details you entered; extraction
              can be redone later.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {extractError ? (
            <button onClick={saveJob} disabled={saving} className="btn-outline">
              <Save className="h-4 w-4" aria-hidden />
              Save with the details I entered
            </button>
          ) : null}
          <button
            onClick={extract}
            disabled={extracting || description.trim().length < 50}
            className="btn-primary"
          >
            <Bot className="h-4 w-4" aria-hidden />
            {extracting ? "Reading the posting..." : "Extract details"}
          </button>
        </div>
      </section>

      {/* Step 2: review extracted details */}
      {extraction ? (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Review and correct
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              The AI read the posting. Correct anything wrong here before the
              job is saved; nothing has been saved yet.
            </p>
          </div>

          {offTarget ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              This role reads as{" "}
              <span className="font-semibold">
                {ROLE_FAMILY_LABELS[roleFamily]}
              </span>
              , which is outside your five target families. It will be flagged
              off-target on the board. You can still keep it; the decision to
              apply stays yours.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="r-title" className="label">
                Title
              </label>
              <input
                id="r-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="r-company" className="label">
                Company
              </label>
              <input
                id="r-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="r-location" className="label">
                Location
              </label>
              <input
                id="r-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="r-workmode" className="label">
                Work mode
              </label>
              <select
                id="r-workmode"
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                className="input"
              >
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {WORK_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="r-family" className="label">
                Role family
              </label>
              <select
                id="r-family"
                value={roleFamily}
                onChange={(e) => setRoleFamily(e.target.value as RoleFamily)}
                className="input"
              >
                {ROLE_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {ROLE_FAMILY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="r-seniority" className="label">
                Seniority
              </label>
              <input
                id="r-seniority"
                value={seniority}
                onChange={(e) => setSeniority(e.target.value)}
                className="input"
                placeholder="e.g. entry level"
              />
            </div>
            <div>
              <label htmlFor="r-closing" className="label">
                Closing date
              </label>
              <input
                id="r-closing"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="r-reason" className="label">
                Role family reason
              </label>
              <input
                id="r-reason"
                value={roleFamilyReason}
                onChange={(e) => setRoleFamilyReason(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SkillsEditor
              label="Required skills"
              skills={requiredSkills}
              onChange={setRequiredSkills}
              placeholder="Add a missing skill"
            />
            <SkillsEditor
              label="Preferred skills"
              skills={preferredSkills}
              onChange={setPreferredSkills}
              placeholder="Add a preferred skill"
            />
          </div>

          <div>
            <label htmlFor="r-instructions" className="label">
              Application instructions
            </label>
            <textarea
              id="r-instructions"
              rows={2}
              value={applicationInstructions}
              onChange={(e) => setApplicationInstructions(e.target.value)}
              className="input"
              placeholder="How and where to apply, what to attach or mention."
            />
          </div>

          <div>
            <span className="label">Description</span>
            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
              {description}
            </div>
          </div>

          {formError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button onClick={() => setExtraction(null)} className="btn-outline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <button onClick={saveJob} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save job"}
            </button>
          </div>
        </section>
      ) : null}

      <p className="text-xs text-stone-400">
        Status starts at {JOB_STATUS_LABELS.saved}. Saving does not apply to
        the job; applications are always recorded by you, manually.
      </p>
    </div>
  );
}
