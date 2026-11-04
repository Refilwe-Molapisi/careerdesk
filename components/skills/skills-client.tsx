"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import type { CareerEntry } from "@/lib/data/types";
import {
  PROFICIENCY_LEVELS,
  SKILL_CATEGORIES,
  createSkillEvidence,
  deleteSkillEvidence,
  isStale,
  updateSkill,
  type Skill,
  type SkillAssessment,
  type SkillEvidence,
} from "@/lib/data/queries/skills";
import { cn, formatDateTime } from "@/lib/utils";

type SkillsClientProps = {
  userId: string;
  skills: Skill[];
  evidence: SkillEvidence[];
  assessments: SkillAssessment[];
  entries: CareerEntry[];
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  analytical: "Analytical",
  economics: "Economics",
  business: "Business",
  research: "Research",
  finance: "Finance",
  operations: "Operations",
  communication: "Communication",
  ai: "AI",
};

const LEVEL_CHIP: Record<string, string> = {
  not_started: "!text-stone-300",
  learning: "!border-sky-200 !bg-sky-50 !text-sky-700",
  basic: "!border-indigo-200 !bg-indigo-50 !text-indigo-700",
  working: "!border-accent/40 !bg-accent-soft !text-accent",
  intermediate: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  advanced: "!border-emerald-300 !bg-emerald-100 !text-emerald-800",
  professional: "!border-emerald-400 !bg-emerald-200 !text-emerald-900",
};

export function SkillsClient({
  userId,
  skills: initialSkills,
  evidence: initialEvidence,
  assessments: initialAssessments,
  entries,
}: SkillsClientProps) {
  const router = useRouter();
  const [skills, setSkills] = useState(initialSkills);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);

  const proposals = assessments.filter((a) => a.status === "proposed");
  const skillsById = useMemo(
    () => new Map(skills.map((s) => [s.id, s])),
    [skills],
  );

  async function assess() {
    setAssessing(true);
    try {
      const res = await fetch("/api/skills/assess", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Assessment failed.");
      toast.success(
        `${payload.count} proposals saved for your review. Nothing changed yet.`,
      );
      location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assessment failed.");
    } finally {
      setAssessing(false);
    }
  }

  async function decide(assessment: SkillAssessment, decision: "accepted" | "changed" | "rejected", level?: string) {
    try {
      const res = await fetch("/api/skills/assess", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessment.id,
          decision,
          decided_level: level,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Could not save.");
      setAssessments((list) =>
        list.map((a) =>
          a.id === assessment.id
            ? { ...a, status: decision, decided_level: (level ?? assessment.proposed_level) as Skill["proficiency"] }
            : a,
        ),
      );
      if (decision !== "rejected") {
        setSkills((list) =>
          list.map((s) =>
            s.id === assessment.skill_id
              ? { ...s, proficiency: (level ?? assessment.proposed_level) as Skill["proficiency"] }
              : s,
          ),
        );
      }
      toast.success(
        decision === "rejected" ? "Proposal rejected." : "Level updated.",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    }
  }

  const filtered = skills.filter(
    (s) =>
      (!categoryFilter || s.category === categoryFilter) &&
      (!levelFilter || s.proficiency === levelFilter),
  );

  return (
    <div className="space-y-4">
      {/* Proposals review list */}
      {proposals.length > 0 ? (
        <section className="card p-5">
          <h2 className="text-base font-semibold text-stone-900">
            {proposals.length} AI proposal{proposals.length === 1 ? "" : "s"} to review
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Nothing has changed yet. Accept, adjust or reject each one.
          </p>
          <ul className="mt-3 space-y-2">
            {proposals.map((a) => {
              const skill = skillsById.get(a.skill_id);
              return (
                <li key={a.id} className="rounded-lg border border-stone-100 px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-stone-900">
                      {skill?.name ?? "Unknown skill"}
                    </span>
                    <span className={cn("chip", LEVEL_CHIP[a.proposed_level])}>
                      {a.proposed_level}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">
                    {a.reasoning}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => decide(a, "accepted")}
                      className="btn-outline !py-1 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden /> Accept
                    </button>
                    <select
                      defaultValue=""
                      onChange={(e) =>
                        e.target.value &&
                        decide(a, "changed", e.target.value)
                      }
                      className="rounded-md border border-stone-200 px-1.5 py-1 text-xs"
                      aria-label={`Change level for ${skill?.name}`}
                    >
                      <option value="">Change level...</option>
                      {PROFICIENCY_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => decide(a, "rejected")}
                      className="text-xs text-stone-400 hover:text-red-600"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Filters + assess */}
      <div className="card flex flex-wrap items-end gap-2 p-4">
        <div>
          <label htmlFor="cat-filter" className="label">Category</label>
          <select
            id="cat-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input"
          >
            <option value="">All</option>
            {SKILL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="level-filter" className="label">Level</label>
          <select
            id="level-filter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="input"
          >
            <option value="">All</option>
            {PROFICIENCY_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <button
          onClick={assess}
          disabled={assessing}
          className="btn-primary ml-auto"
        >
          {assessing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Bot className="h-4 w-4" aria-hidden />
          )}
          {assessing ? "Assessing..." : "Assess my skills"}
        </button>
      </div>

      {/* Grouped list */}
      {SKILL_CATEGORIES.map((category) => {
        const group = filtered.filter((s) => s.category === category);
        if (group.length === 0) return null;
        return (
          <section key={category} className="card p-5">
            <h2 className="text-sm font-semibold text-stone-900">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="mt-3 space-y-1">
              {group.map((skill) => {
                const skillEvidence = evidence.filter((e) => e.skill_id === skill.id);
                const history = assessments.filter((a) => a.skill_id === skill.id);
                const open = openId === skill.id;
                const stale = isStale(skill);
                return (
                  <li key={skill.id} className="rounded-lg">
                    <button
                      onClick={() => setOpenId(open ? null : skill.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-stone-50"
                      aria-expanded={open}
                    >
                      <span className="flex items-center gap-2 text-sm text-stone-800">
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 text-stone-300 transition-transform", open && "rotate-180")}
                          aria-hidden
                        />
                        {skill.name}
                        {skill.practical_experience ? (
                          <span className="chip !border-emerald-200 !bg-emerald-50 !text-emerald-700">practical</span>
                        ) : null}
                        {stale ? (
                          <span className="chip !border-amber-200 !bg-amber-50 !text-amber-800">stale</span>
                        ) : null}
                      </span>
                      <span className={cn("chip", LEVEL_CHIP[skill.proficiency])}>
                        {skill.proficiency}
                      </span>
                    </button>
                    {open ? (
                      <SkillDetail
                        skill={skill}
                        evidence={skillEvidence}
                        history={history}
                        entries={entries}
                        userId={userId}
                        onChanged={async () => {
                          const client = createClient();
                          const [{ listSkills: ls }, { listSkillEvidence: le }, { listSkillAssessments: la }] =
                            await Promise.all([
                              import("@/lib/data/queries/skills"),
                              import("@/lib/data/queries/skills"),
                              import("@/lib/data/queries/skills"),
                            ]);
                          setSkills(await ls(client));
                          setEvidence(await le(client));
                          setAssessments(await la(client));
                          router.refresh();
                        }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SkillDetail({
  skill,
  evidence,
  history,
  entries,
  userId,
  onChanged,
}: {
  skill: Skill;
  evidence: SkillEvidence[];
  history: SkillAssessment[];
  entries: CareerEntry[];
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    evidence_type: "employment" as SkillEvidence["evidence_type"],
    description: "",
    link: "",
    date: "",
    career_entry_id: "",
  });
  const [level, setLevel] = useState(skill.proficiency);
  const [learningStatus, setLearningStatus] = useState(skill.learning_status);
  const [lastUsed, setLastUsed] = useState(skill.last_used ?? "");
  const [busy, setBusy] = useState(false);

  async function saveSkill() {
    setBusy(true);
    try {
      await updateSkill(createClient(), skill.id, {
        proficiency: level,
        learning_status: learningStatus,
        last_used: lastUsed || null,
      });
      toast.success("Skill saved.");
      await onChanged();
    } catch (err) {
      // The DB trigger's evidence rules surface here verbatim.
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function addEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setBusy(true);
    try {
      await createSkillEvidence(createClient(), {
        user_id: userId,
        skill_id: skill.id,
        evidence_type: form.evidence_type,
        description: form.description.trim(),
        link: form.link.trim() || null,
        date: form.date || null,
        career_entry_id: form.career_entry_id || null,
      });
      setForm({ ...form, description: "", link: "", date: "", career_entry_id: "" });
      setAdding(false);
      toast.success("Evidence added.");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add evidence.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2 space-y-3 rounded-lg bg-stone-50 px-3 py-3">
      {/* Level editor */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor={`level-${skill.id}`}>Level</label>
          <select
            id={`level-${skill.id}`}
            value={level}
            onChange={(e) => setLevel(e.target.value as Skill["proficiency"])}
            className="input"
          >
            {PROFICIENCY_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`ls-${skill.id}`}>Learning status</label>
          <select
            id={`ls-${skill.id}`}
            value={learningStatus}
            onChange={(e) => setLearningStatus(e.target.value as Skill["learning_status"])}
            className="input"
          >
            {["not_started", "learning", "practising", "applied", "maintained"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`lu-${skill.id}`}>Last used</label>
          <input
            id={`lu-${skill.id}`}
            type="date"
            value={lastUsed}
            onChange={(e) => setLastUsed(e.target.value)}
            className="input"
          />
        </div>
        <button onClick={saveSkill} disabled={busy} className="btn-outline">
          Save
        </button>
      </div>

      {/* Evidence */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Evidence
          </p>
          <button
            onClick={() => setAdding(!adding)}
            className="text-xs font-medium text-accent hover:underline"
          >
            {adding ? "Cancel" : "Add evidence"}
          </button>
        </div>
        {adding ? (
          <form onSubmit={addEvidence} className="mt-2 grid gap-2 sm:grid-cols-2">
            <select
              value={form.evidence_type}
              onChange={(e) => setForm({ ...form, evidence_type: e.target.value as SkillEvidence["evidence_type"] })}
              className="input"
              aria-label="Evidence type"
            >
              {["employment", "education", "project", "certificate", "self_study"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={form.career_entry_id}
              onChange={(e) => setForm({ ...form, career_entry_id: e.target.value })}
              className="input"
              aria-label="Link to career entry (transferable skills)"
            >
              <option value="">Link a career entry (optional)</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                  {entry.organisation ? ` - ${entry.organisation}` : ""}
                </option>
              ))}
            </select>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input sm:col-span-2"
              placeholder="What shows this skill? A number, a link or a plain statement."
              required
            />
            <input
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              className="input"
              placeholder="Link (optional)"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input"
              aria-label="Evidence date"
            />
            <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
              <Plus className="h-4 w-4" aria-hidden /> Add evidence
            </button>
          </form>
        ) : null}
        <ul className="mt-2 space-y-1.5">
          {evidence.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-xs">
              <span className="min-w-0">
                <span className="font-medium text-stone-700">{item.evidence_type}:</span>{" "}
                <span className="text-stone-600">{item.description}</span>
                {item.link ? (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="ml-1 text-accent hover:underline">
                    link
                  </a>
                ) : null}
                {item.date ? <span className="ml-1 text-stone-400">({item.date})</span> : null}
              </span>
              <button
                onClick={async () => {
                  try {
                    await deleteSkillEvidence(createClient(), item.id);
                    toast.success("Evidence removed.");
                    await onChanged();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not remove.");
                  }
                }}
                className="shrink-0 text-stone-300 hover:text-red-600"
                aria-label="Remove evidence"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {evidence.length === 0 ? (
            <li className="text-xs text-stone-400">
              No evidence yet. Employment or project evidence is required for
              intermediate and above; certificates alone cap the level at basic.
            </li>
          ) : null}
        </ul>
      </div>

      {/* Assessment history */}
      {history.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Assessment history
          </p>
          <ul className="mt-1.5 space-y-1">
            {history.slice(0, 5).map((a) => (
              <li key={a.id} className="text-xs text-stone-500">
                <span className="font-medium text-stone-600">{a.proposed_level}</span> ·{" "}
                {a.status}
                {a.decided_level && a.decided_level !== a.proposed_level
                  ? ` (changed to ${a.decided_level})`
                  : ""}{" "}
                · {formatDateTime(a.created_at)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
