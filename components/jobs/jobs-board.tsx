"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, GripVertical, LayoutGrid, Table2 } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";
import { updateJob } from "@/lib/data/queries/jobs";
import { EligibilityBadge } from "@/components/jobs/eligibility";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  ROLE_FAMILY_LABELS,
  TARGET_ROLE_FAMILIES,
  type Job,
  type JobStatus,
} from "@/lib/data/types";
import { cn, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Briefcase } from "lucide-react";

type JobsBoardProps = {
  jobs: Job[];
  initialStatusFilter: string;
};

type ViewMode = "board" | "table";
type FollowUpFilter = "any" | "overdue" | "this-week";

const VIEW_STORAGE_KEY = "careerdesk:jobs-view";

export function JobsBoard({ jobs, initialStatusFilter }: JobsBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("board");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [companyFilter, setCompanyFilter] = useState("");
  const [foundFrom, setFoundFrom] = useState("");
  const [foundTo, setFoundTo] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("any");
  const [eligibilityFilter, setEligibilityFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    // Restore the saved view after hydration; a lazy useState initializer
    // would read window during SSR and a synchronous read here would fight
    // the hydration pass.
    const raf = requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "table" || saved === "board") setView(saved);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function switchView(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const filtered = useMemo(() => {
    const today = new Date();
    const weekAhead = new Date(today);
    weekAhead.setDate(today.getDate() + 7);
    const todayIso = toDateIso(today);
    const weekIso = toDateIso(weekAhead);
    const q = companyFilter.trim().toLowerCase();

    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (
        q &&
        ![job.company, job.title].filter(Boolean).some(
          (f) => (f as string).toLowerCase().includes(q),
        )
      )
        return false;
      if (foundFrom && job.date_found < foundFrom) return false;
      if (foundTo && job.date_found > foundTo) return false;
      if (eligibilityFilter && job.eligibility_status !== eligibilityFilter)
        return false;
      if (followUpFilter !== "any") {
        if (!job.follow_up_date) return false;
        if (followUpFilter === "overdue" && job.follow_up_date >= todayIso)
          return false;
        if (
          followUpFilter === "this-week" &&
          !(job.follow_up_date >= todayIso && job.follow_up_date <= weekIso)
        )
          return false;
      }
      return true;
    });
  }, [jobs, statusFilter, companyFilter, foundFrom, foundTo, followUpFilter, eligibilityFilter]);

  async function changeStatus(job: Job, status: JobStatus) {
    if (job.status === status) return;
    setBusyId(job.id);
    try {
      // The DB trigger writes status_history and refreshes status_updated_at.
      await updateJob(createClient(), job.id, { status });
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update the status.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function setFollowUp(job: Job, date: string) {
    setBusyId(job.id);
    try {
      await updateJob(createClient(), job.id, { follow_up_date: date || null });
      toast.success(date ? "Follow-up date saved." : "Follow-up date cleared.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the date.");
    } finally {
      setBusyId(null);
    }
  }

  const hasAnyFilter =
    statusFilter !== "all" ||
    companyFilter !== "" ||
    foundFrom !== "" ||
    foundTo !== "" ||
    followUpFilter !== "any" ||
    eligibilityFilter !== "";

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No saved jobs yet"
        description="Paste a job link or description to save your first vacancy. The app reads the posting and proposes the details for you to confirm."
      >
        <Link href="/jobs/new" className="btn-primary">
          Add a job
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/jobs/new" className="btn-primary">
          Add a job
        </Link>
        <div className="flex rounded-lg border border-stone-200 bg-surface p-0.5">
          <button
            onClick={() => switchView("board")}
            aria-pressed={view === "board"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              view === "board"
                ? "bg-accent-soft text-accent"
                : "text-stone-500 hover:text-stone-800",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Board
          </button>
          <button
            onClick={() => switchView("table")}
            aria-pressed={view === "table"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              view === "table"
                ? "bg-accent-soft text-accent"
                : "text-stone-500 hover:text-stone-800",
            )}
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden /> Table
          </button>
        </div>
      </div>

      {/* Filters */}
      <details className="card px-4 py-3" open={hasAnyFilter}>
        <summary className="cursor-pointer select-none text-sm font-medium text-stone-700">
          Filters
          {hasAnyFilter ? (
            <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
              active
            </span>
          ) : null}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="f-status" className="label">
              Status
            </label>
            <select
              id="f-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                const params = new URLSearchParams(searchParams.toString());
                if (e.target.value === "all") params.delete("status");
                else params.set("status", e.target.value);
                router.replace(e.target.value === "all" ? "/jobs" : `/jobs?${params}`);
              }}
              className="input"
            >
              <option value="all">All statuses</option>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-elig" className="label">Eligibility</label>
            <select
              id="f-elig"
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              className="input"
            >
              <option value="">Any</option>
              <option value="eligible">Eligible</option>
              <option value="potentially_eligible">Potentially eligible</option>
              <option value="ineligible">Ineligible</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-company" className="label">
              Company or title
            </label>
            <input
              id="f-company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="input"
              placeholder="Search..."
            />
          </div>
          <div>
            <label htmlFor="f-from" className="label">
              Found from
            </label>
            <input
              id="f-from"
              type="date"
              value={foundFrom}
              onChange={(e) => setFoundFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="f-to" className="label">
              Found to
            </label>
            <input
              id="f-to"
              type="date"
              value={foundTo}
              onChange={(e) => setFoundTo(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="f-followup" className="label">
              Follow-up
            </label>
            <select
              id="f-followup"
              value={followUpFilter}
              onChange={(e) => setFollowUpFilter(e.target.value as FollowUpFilter)}
              className="input"
            >
              <option value="any">Any</option>
              <option value="overdue">Overdue</option>
              <option value="this-week">Due this week</option>
            </select>
          </div>
        </div>
        {hasAnyFilter ? (
          <button
            onClick={() => {
              setStatusFilter("all");
              setCompanyFilter("");
              setFoundFrom("");
              setFoundTo("");
              setFollowUpFilter("any");
              router.replace("/jobs");
            }}
            className="mt-3 text-xs text-stone-400 underline hover:text-stone-700"
          >
            Clear all filters
          </button>
        ) : null}
      </details>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nothing matches these filters"
          description="No jobs match the current filters. Clear them to see the full board."
        >
          <button
            onClick={() => {
              setStatusFilter("all");
              setCompanyFilter("");
              setFoundFrom("");
              setFoundTo("");
              setFollowUpFilter("any");
              router.replace("/jobs");
            }}
            className="btn-outline"
          >
            Clear filters
          </button>
        </EmptyState>
      ) : view === "board" ? (
        <KanbanBoard jobs={filtered} busyId={busyId} onStatusChange={changeStatus} />
      ) : (
        <JobsTable
          jobs={filtered}
          busyId={busyId}
          onStatusChange={changeStatus}
          onFollowUp={setFollowUp}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban with pointer-based drag & drop (works with mouse and touch)
// ---------------------------------------------------------------------------

function KanbanBoard({
  jobs,
  busyId,
  onStatusChange,
}: {
  jobs: Job[];
  busyId: string | null;
  onStatusChange: (job: Job, status: JobStatus) => void;
}) {
  const [dragging, setDragging] = useState<{ job: Job; x: number; y: number } | null>(
    null,
  );
  const [hoverColumn, setHoverColumn] = useState<JobStatus | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  function beginDrag(e: React.PointerEvent) {
    if (busyId) return;
    startPoint.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent, job: Job) {
    if (!startPoint.current) return;
    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;
    if (!dragging && Math.hypot(dx, dy) > 6) {
      setDragging({ job, x: e.clientX, y: e.clientY });
    }
    if (dragging) {
      setDragging({ job, x: e.clientX, y: e.clientY });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const column = el?.closest<HTMLElement>("[data-kanban-status]");
      setHoverColumn((column?.dataset.kanbanStatus as JobStatus) ?? null);
    }
  }

  function endDrag(e: React.PointerEvent, job: Job) {
    if (dragging) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const column = el?.closest<HTMLElement>("[data-kanban-status]");
      const target = column?.dataset.kanbanStatus as JobStatus | undefined;
      if (target && target !== job.status) {
        onStatusChange(job, target);
      }
    }
    setDragging(null);
    setHoverColumn(null);
    startPoint.current = null;
  }

  return (
    <>
      {dragging ? (
        <div
          className="pointer-events-none fixed z-50 w-56 rotate-2 opacity-90"
          style={{ left: dragging.x - 90, top: dragging.y - 24 }}
        >
          <JobCard job={dragging.job} ghost />
        </div>
      ) : null}

      <div className="-mx-4 overflow-x-auto pb-2 sm:mx-0">
        <div className="flex min-h-[60vh] gap-3 px-4 sm:px-0">
          {JOB_STATUSES.map((status) => {
            const columnJobs = jobs.filter((j) => j.status === status);
            const highlighted = hoverColumn === status;
            return (
              <div
                key={status}
                data-kanban-status={status}
                className={cn(
                  "flex w-60 shrink-0 flex-col rounded-xl border bg-stone-100/60 transition-colors",
                  highlighted
                    ? "border-accent bg-accent-soft/60"
                    : "border-stone-200",
                )}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {JOB_STATUS_LABELS[status]}
                  </h3>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                    {columnJobs.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 px-2 pb-2">
                  {columnJobs.map((job) => (
                    <div
                      key={job.id}
                      className={cn(
                        "touch-pan-y",
                        dragging?.job.id === job.id && "opacity-30",
                      )}
                    >
                      <JobCard
                        job={job}
                        busy={busyId === job.id}
                        onDragStart={beginDrag}
                        onDragMove={(e) => moveDrag(e, job)}
                        onDragEnd={(e) => endDrag(e, job)}
                        onStatusChange={(s) => onStatusChange(job, s)}
                      />
                    </div>
                  ))}
                  {columnJobs.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-stone-200 px-3 py-4 text-center text-[11px] text-stone-300">
                      Drop here
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function JobCard({
  job,
  ghost,
  busy,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStatusChange,
}: {
  job: Job;
  ghost?: boolean;
  busy?: boolean;
  onDragStart?: (e: React.PointerEvent) => void;
  onDragMove?: (e: React.PointerEvent) => void;
  onDragEnd?: (e: React.PointerEvent) => void;
  onStatusChange?: (status: JobStatus) => void;
}) {
  const offTarget = !TARGET_ROLE_FAMILIES.includes(job.role_family);
  const overdue =
    job.follow_up_date !== null && job.follow_up_date < toDateIso(new Date());

  return (
    <article
      className={cn(
        "card select-none p-3",
        ghost && "shadow-lg",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-stone-300 hover:text-stone-500"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="button"
          aria-label={`Drag ${job.title ?? "job"} to another column`}
          tabIndex={0}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/jobs/${job.id}`}
            className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900 hover:text-accent"
          >
            {job.title ?? "Untitled role"}
          </Link>
          <p className="mt-0.5 truncate text-xs text-stone-500">
            {job.company ?? "Unknown company"}
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        {offTarget ? (
          <span className="chip !border-amber-200 !bg-amber-50 !text-amber-800">
            off-target
          </span>
        ) : null}
        {job.follow_up_date ? (
          <span
            className={cn(
              "chip gap-1",
              overdue && "!border-red-200 !bg-red-50 !text-red-700",
            )}
          >
            <CalendarClock className="h-3 w-3" aria-hidden />
            {job.follow_up_date}
          </span>
        ) : null}
      </div>

      {onStatusChange ? (
        <div className="mt-2 pl-6">
          <label className="sr-only" htmlFor={`status-${job.id}`}>
            Status
          </label>
          <select
            id={`status-${job.id}`}
            value={job.status}
            disabled={busy}
            onChange={(e) => onStatusChange(e.target.value as JobStatus)}
            className="w-full rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600 focus:border-accent focus:outline-none"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

function JobsTable({
  jobs,
  busyId,
  onStatusChange,
  onFollowUp,
}: {
  jobs: Job[];
  busyId: string | null;
  onStatusChange: (job: Job, status: JobStatus) => void;
  onFollowUp: (job: Job, date: string) => void;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400">
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Family</th>
            <th className="px-4 py-3 font-medium">Eligibility</th>
            <th className="px-4 py-3 font-medium">Salary</th>
            <th className="px-4 py-3 font-medium">Found</th>
            <th className="px-4 py-3 font-medium">Follow-up</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const offTarget = !TARGET_ROLE_FAMILIES.includes(job.role_family);
            return (
              <tr
                key={job.id}
                className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-stone-900 hover:text-accent"
                  >
                    {job.title ?? "Untitled role"}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {job.company ?? "Unknown company"}
                    {offTarget ? " · off-target" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <EligibilityBadge status={job.eligibility_status} />
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {job.salary_currency
                    ? [job.salary_min ?? "?", job.salary_max ?? job.salary_min ?? "?"]
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(" - ") + ` ${job.salary_currency}`
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`t-status-${job.id}`}>
                    Status
                  </label>
                  <select
                    id={`t-status-${job.id}`}
                    value={job.status}
                    disabled={busyId === job.id}
                    onChange={(e) =>
                      onStatusChange(job, e.target.value as JobStatus)
                    }
                    className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600 focus:border-accent focus:outline-none"
                  >
                    {JOB_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {JOB_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {ROLE_FAMILY_LABELS[job.role_family]}
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {job.date_found}
                </td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`t-follow-${job.id}`}>
                    Follow-up date
                  </label>
                  <input
                    id={`t-follow-${job.id}`}
                    type="date"
                    value={job.follow_up_date ?? ""}
                    disabled={busyId === job.id}
                    onChange={(e) => onFollowUp(job, e.target.value)}
                    className="rounded-md border border-stone-200 px-2 py-1 text-xs focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3 text-xs text-stone-400">
                  {formatDateTime(job.status_updated_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
