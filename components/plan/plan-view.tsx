"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Square,
  Wand2,
} from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import type {
  HourLog,
  PlanItem,
  Project,
  ProjectDeliverable,
  WeeklyReview,
} from "@/lib/data/queries/plan";
import {
  createPlanItem,
  deletePlanItem,
  listPlanItems,
  seedSixProjects,
  setPlanItemStatus,
  toggleDeliverable,
  upsertHourLog,
  upsertWeeklyReview,
  listWeeklyReviews,
  listHourLogs,
} from "@/lib/data/queries/plan";
import {
  HOUR_CATEGORIES,
  EXAM_TARGET_HOURS,
  WEEKLY_TARGET_HOURS,
  WEEKLY_WARNING_HOURS,
  hoursFor,
  toDateIso,
  weekDays,
  weekTotalHours,
} from "@/lib/operations/plan-week";
import { cn } from "@/lib/utils";

type PlanViewProps = {
  userId: string;
  initialLogs: HourLog[];
  initialItems: PlanItem[];
  projects: Project[];
  deliverables: ProjectDeliverable[];
  reviews: WeeklyReview[];
  nowIso: string;
};

export function PlanView({
  userId,
  initialLogs,
  initialItems,
  projects,
  deliverables,
  reviews,
  nowIso,
}: PlanViewProps) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [items, setItems] = useState(initialItems);
  const [monday, setMonday] = useState(() => {
    const d = new Date(nowIso);
    const dow = d.getDay();
    d.setDate(d.getDate() - ((dow + 6) % 7));
    return d;
  });
  const [busy, setBusy] = useState(false);

  const weekStartIso = toDateIso(monday);
  const days = useMemo(() => weekDays(monday), [monday]);
  const review = reviews.find((r) => r.week_start === weekStartIso) ?? null;
  const examWeek = review?.exam_week ?? false;
  const target = examWeek ? EXAM_TARGET_HOURS : WEEKLY_TARGET_HOURS;

  const total = weekTotalHours(logs, monday);

  function shiftWeek(delta: number) {
    const next = new Date(monday);
    next.setDate(monday.getDate() + delta * 7);
    setMonday(next);
  }

  async function saveHours(iso: string, category: HourLog["category"], raw: string) {
    const hours = Number(raw);
    if (Number.isNaN(hours)) return;
    setBusy(true);
    try {
      await upsertHourLog(createClient(), {
        user_id: userId,
        log_date: iso,
        category,
        hours: Math.min(24, Math.max(0, Math.round(hours * 10) / 10)),
      });
      setLogs(await listHourLogs(createClient()));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save hours.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleExamWeek() {
    setBusy(true);
    try {
      await upsertWeeklyReview(createClient(), {
        user_id: userId,
        week_start: weekStartIso,
        exam_week: !examWeek,
        built: review?.built ?? null,
        skill_shown: review?.skill_shown ?? null,
        next_deliverable: review?.next_deliverable ?? null,
        blocked: review?.blocked ?? null,
        protected_university: review?.protected_university ?? null,
        next_publish_or_apply: review?.next_publish_or_apply ?? null,
      });
      setReviewsState(await listWeeklyReviews(createClient()));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const [reviewsState, setReviewsState] = useState(reviews);
  const currentReview = reviewsState.find((r) => r.week_start === weekStartIso) ?? null;

  return (
    <div className="space-y-6">
      {/* Week navigation + exam toggle */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)} className="btn-ghost" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm font-semibold text-stone-900">
            Week of {weekStartIso}
          </span>
          <button onClick={() => shiftWeek(1)} className="btn-ghost" aria-label="Next week">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={examWeek}
            onChange={toggleExamWeek}
            disabled={busy}
            className="h-4 w-4 rounded border-stone-300 text-accent focus:ring-accent"
          />
          Exam week (target {EXAM_TARGET_HOURS}h)
        </label>
      </div>

      {total > WEEKLY_WARNING_HOURS ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          You are at {total} hours this week, past the 20-hour ceiling. Exams
          and health come first; move work to next week.
        </p>
      ) : null}

      {/* Hours grid */}
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">
            Hours this week
          </h2>
          <p className="text-xs text-stone-500">
            {total} of {target} target hours · Sunday is rest and cannot be
            scheduled
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-stone-400">
                <th className="px-2 py-2 text-left font-medium">Category</th>
                {days.map((d) => (
                  <th key={d.iso} className={cn("px-1 py-2 font-medium", d.isSunday && "text-stone-300")}>
                    {d.label}
                    <span className="block text-[10px] font-normal normal-case text-stone-300">
                      {d.iso.slice(5)}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {HOUR_CATEGORIES.map((category) => {
                const logged = days.reduce(
                  (sum, d) => sum + hoursFor(logs, d.iso, category.key),
                  0,
                );
                return (
                  <tr key={category.key} className="border-t border-stone-100">
                    <td className="px-2 py-2 text-xs font-medium text-stone-700">
                      {category.label}
                    </td>
                    {days.map((d) => (
                      <td key={d.iso} className="px-1 py-1.5">
                        <input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          disabled={busy || d.isSunday}
                          defaultValue={
                            hoursFor(logs, d.iso, category.key) || ""
                          }
                          onBlur={(e) => void saveHours(d.iso, category.key, e.target.value)}
                          aria-label={`${category.label} on ${d.iso}`}
                          className={cn(
                            "w-12 rounded-md border border-stone-200 px-1.5 py-1 text-center text-xs focus:border-accent focus:outline-none",
                            d.isSunday && "cursor-not-allowed bg-stone-100 text-stone-300",
                          )}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center text-xs text-stone-500">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${Math.min(100, (logged / category.target) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="mt-0.5 block">
                        {logged}/{category.target}h
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <MonthlyTopics items={items} userId={userId} setItems={setItems} />
      <PortfolioChecklist
        projects={projects}
        deliverables={deliverables}
        userId={userId}
      />
      <SaturdayReview
        userId={userId}
        weekStartIso={weekStartIso}
        review={currentReview}
      />
      <ReviewHistory reviews={reviewsState} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly learning topics
// ---------------------------------------------------------------------------

function MonthlyTopics({
  items,
  userId,
  setItems,
}: {
  items: PlanItem[];
  userId: string;
  setItems: (items: PlanItem[]) => void;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(toDateIso(new Date()).slice(0, 7));
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const topics = items.filter((i) => i.kind === "learning_topic");
  const byMonth = new Map<string, PlanItem[]>();
  for (const topic of topics) {
    const key = topic.month?.slice(0, 7) ?? "unassigned";
    byMonth.set(key, [...(byMonth.get(key) ?? []), topic]);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createPlanItem(createClient(), {
        user_id: userId,
        kind: "learning_topic",
        month: `${month}-01`,
        title: title.trim(),
      });
      setTitle("");
      setItems(await listPlanItems(createClient()));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
        <ClipboardList className="h-4 w-4 text-accent" aria-hidden />
        Monthly learning topics
      </h2>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="topic-month" className="label">
            Month
          </label>
          <input
            id="topic-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="topic-title" className="label">
            Topic
          </label>
          <input
            id="topic-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="e.g. Window functions in SQL"
          />
        </div>
        <button type="submit" disabled={busy || !title.trim()} className="btn-outline">
          Add
        </button>
      </form>

      <div className="mt-4 space-y-4">
        {Array.from(byMonth.entries()).map(([monthKey, monthTopics]) => (
          <div key={monthKey}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              {monthKey}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {monthTopics.map((topic) => (
                <li key={topic.id} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={async () => {
                      const next = topic.status === "done" ? "todo" : "done";
                      await setPlanItemStatus(createClient(), topic.id, next);
                      setItems(await listPlanItems(createClient()));
                      router.refresh();
                    }}
                    className="text-stone-400 hover:text-accent"
                    aria-label={topic.status === "done" ? "Mark as not done" : "Mark as done"}
                  >
                    {topic.status === "done" ? (
                      <CheckSquare className="h-4 w-4 text-accent" aria-hidden />
                    ) : (
                      <Square className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-stone-700",
                      topic.status === "done" && "text-stone-400 line-through",
                    )}
                  >
                    {topic.title}
                  </span>
                  <button
                    onClick={async () => {
                      await deletePlanItem(createClient(), topic.id);
                      setItems(await listPlanItems(createClient()));
                      router.refresh();
                    }}
                    className="text-xs text-stone-300 hover:text-red-600"
                    aria-label={`Delete ${topic.title}`}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {topics.length === 0 ? (
          <p className="text-xs text-stone-400">
            No topics yet. Add the month&apos;s learning topic here and tick it off
            when done.
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Portfolio projects
// ---------------------------------------------------------------------------

function PortfolioChecklist({
  projects,
  deliverables,
  userId,
}: {
  projects: Project[];
  deliverables: ProjectDeliverable[];
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    try {
      await seedSixProjects(createClient(), userId);
      toast.success("The six portfolio projects were added with their deliverables.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add projects.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">
          Portfolio projects
        </h2>
        {projects.length === 0 ? (
          <button onClick={seed} disabled={busy} className="btn-outline">
            <Wand2 className="h-4 w-4" aria-hidden />
            {busy ? "Adding..." : "Set up the six portfolio projects"}
          </button>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <p className="mt-2 text-xs text-stone-400">
          The plan&apos;s six portfolio projects, each with its deliverables as
          ticks: dataset documented, SQL queries, dashboard, five findings,
          README, portfolio page.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {projects.map((project) => {
            const items = deliverables.filter((d) => d.project_id === project.id);
            const done = items.filter((d) => d.done).length;
            return (
              <div key={project.id} className="rounded-lg border border-stone-100 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">{project.name}</p>
                  <span className="chip">{done}/{items.length}</span>
                </div>
                {project.question ? (
                  <p className="mt-0.5 text-xs text-stone-400">{project.question}</p>
                ) : null}
                <ul className="mt-2 space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-600">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={async () => {
                            await toggleDeliverable(
                              createClient(),
                              item.id,
                              !item.done,
                            );
                            router.refresh();
                          }}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-accent focus:ring-accent"
                        />
                        <span className={cn(item.done && "text-stone-400 line-through")}>
                          {item.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Saturday weekly review
// ---------------------------------------------------------------------------

function SaturdayReview({
  userId,
  weekStartIso,
  review,
}: {
  userId: string;
  weekStartIso: string;
  review: WeeklyReview | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    built: review?.built ?? "",
    skill_shown: review?.skill_shown ?? "",
    next_deliverable: review?.next_deliverable ?? "",
    blocked: review?.blocked ?? "",
    protected_university: review?.protected_university ?? false,
    next_publish_or_apply: review?.next_publish_or_apply ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertWeeklyReview(createClient(), {
        user_id: userId,
        week_start: weekStartIso,
        exam_week: review?.exam_week ?? false,
        built: form.built.trim() || null,
        skill_shown: form.skill_shown.trim() || null,
        next_deliverable: form.next_deliverable.trim() || null,
        blocked: form.blocked.trim() || null,
        protected_university: form.protected_university,
        next_publish_or_apply: form.next_publish_or_apply.trim() || null,
      });
      toast.success("Weekly review saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const fields: {
    key: keyof typeof form;
    label: string;
    textarea?: boolean;
  }[] = [
    { key: "built", label: "What did I build this week?", textarea: true },
    { key: "skill_shown", label: "Which skill can I show without a tutorial?" },
    { key: "next_deliverable", label: "Next smallest deliverable" },
    { key: "blocked", label: "What is blocked?", textarea: true },
    { key: "next_publish_or_apply", label: "What will I publish or apply for next week?" },
  ];

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-stone-900">
        Saturday weekly review
      </h2>
      <p className="mt-0.5 text-xs text-stone-500">
        One saved review per week, keyed to the week of {weekStartIso}.
      </p>
      <form onSubmit={save} className="mt-4 space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={`review-${field.key}`} className="label">
              {field.label}
            </label>
            {field.textarea ? (
              <textarea
                id={`review-${field.key}`}
                rows={2}
                value={form[field.key] as string}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="input"
              />
            ) : (
              <input
                id={`review-${field.key}`}
                value={form[field.key] as string}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="input"
              />
            )}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={form.protected_university}
            onChange={(e) =>
              setForm({ ...form, protected_university: e.target.checked })
            }
            className="h-4 w-4 rounded border-stone-300 text-accent focus:ring-accent"
          />
          I protected my university work this week
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save weekly review"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ReviewHistory({ reviews }: { reviews: WeeklyReview[] }) {
  const answered = reviews.filter(
    (r) => r.built || r.skill_shown || r.next_deliverable || r.blocked || r.next_publish_or_apply,
  );
  if (answered.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold text-stone-900">Review history</h2>
      <ul className="mt-3 space-y-3">
        {answered.map((review) => (
          <li key={review.id} className="rounded-lg border border-stone-100 px-3 py-2.5 text-sm">
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-stone-900">
                Week of {review.week_start}
                {review.exam_week ? (
                  <span className="chip ml-2 !border-amber-200 !bg-amber-50 !text-amber-800">
                    exam week
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-stone-400">
                {review.protected_university ? "university protected" : ""}
              </span>
            </p>
            {review.built ? (
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                <span className="font-medium text-stone-500">Built:</span>{" "}
                {review.built}
              </p>
            ) : null}
            {review.skill_shown ? (
              <p className="text-xs leading-relaxed text-stone-600">
                <span className="font-medium text-stone-500">Skill:</span>{" "}
                {review.skill_shown}
              </p>
            ) : null}
            {review.next_publish_or_apply ? (
              <p className="text-xs leading-relaxed text-stone-600">
                <span className="font-medium text-stone-500">Next:</span>{" "}
                {review.next_publish_or_apply}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
