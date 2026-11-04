import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  CalendarClock,
  LayoutDashboard,
  Quote,
} from "lucide-react";
import { requireUser } from "@/lib/data/auth";
import { listJobs } from "@/lib/data/queries/jobs";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  TARGET_ROLE_FAMILIES,
  type Job,
  type JobStatus,
} from "@/lib/data/types";
import {
  RECOMMENDATION_LABELS,
  recommendationRank,
} from "@/lib/operations/prioritise";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Dashboard",
};

const STALE_STATUSES: JobStatus[] = [
  "saved",
  "tailoring",
  "ready",
  "applied",
  "interviewing",
];

function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();
  const jobs = await listJobs(supabase);

  const today = new Date();
  const weekAhead = new Date(today);
  weekAhead.setDate(today.getDate() + 7);
  const todayIso = toDateIso(today);
  const weekIso = toDateIso(weekAhead);
  const staleCutoff = new Date(today);
  staleCutoff.setDate(today.getDate() - 7);

  const counts = new Map<JobStatus, number>(
    JOB_STATUSES.map((s) => [s, 0] as const),
  );
  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  }

  const followUps = jobs
    .filter((j) => j.follow_up_date !== null && j.follow_up_date <= weekIso)
    .sort((a, b) => (a.follow_up_date ?? "").localeCompare(b.follow_up_date ?? ""));

  const stale = jobs.filter(
    (j) =>
      STALE_STATUSES.includes(j.status) &&
      new Date(j.status_updated_at) < staleCutoff,
  );

  if (jobs.length === 0) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${user.email?.split("@")[0] ?? "there"}`}
          description="Your job search at a glance."
        />
        <EmptyState
          icon={LayoutDashboard}
          title="Nothing to show yet"
          description="Counts per status, follow-ups due this week and jobs with no activity for 7 days will appear here once you start saving jobs."
        >
          <Link href="/jobs/new" className="btn-primary">
            Add your first job
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your job search at a glance."
      />

      <div className="space-y-6">
        {/* This week (Prompt 23): up to five jobs by recommendation,
            closing date and follow-up due. */}
        {(() => {
          const thisWeek = jobs
            .filter((j) => !["offer", "rejected", "withdrawn", "closed"].includes(j.status))
            .sort((a, b) => {
              const rec = recommendationRank(a) - recommendationRank(b);
              if (rec !== 0) return rec;
              const aDue = a.closing_date ?? a.follow_up_date ?? "9999-12-31";
              const bDue = b.closing_date ?? b.follow_up_date ?? "9999-12-31";
              if (aDue !== bDue) return aDue < bDue ? -1 : 1;
              return recommendationRank(a) - recommendationRank(b);
            })
            .slice(0, 5);
          if (thisWeek.length === 0) return null;
          return (
            <section className="card p-5" aria-label="This week">
              <h2 className="text-base font-semibold text-stone-900">This week</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Up to five jobs ordered by recommendation, closing date and
                follow-up due. Off-target families are labelled.
              </p>
              <ol className="mt-3 space-y-2">
                {thisWeek.map((job, i) => (
                  <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2">
                    <span className="min-w-0 text-sm">
                      <span className="mr-1.5 font-semibold text-stone-300">{i + 1}.</span>
                      <Link href={`/jobs/${job.id}`} className="font-medium text-stone-900 hover:text-accent">
                        {job.title ?? "Untitled role"}
                      </Link>
                      <span className="ml-1.5 text-xs text-stone-500">{job.company ?? ""}</span>
                      {!TARGET_ROLE_FAMILIES.includes(job.role_family) ? (
                        <span className="chip ml-1.5 !border-amber-200 !bg-amber-50 !text-amber-800">off-target</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-stone-500">
                      {job.recommendation ? (
                        <span className="chip">{RECOMMENDATION_LABELS[job.recommendation]}</span>
                      ) : null}
                      {job.closing_date ? <span>closes {job.closing_date}</span> : null}
                      {job.follow_up_date ? <span>follow-up {job.follow_up_date}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })()}

        {/* Counts per status */}
        <section aria-label="Counts per status">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {JOB_STATUSES.map((status) => (
              <Link
                key={status}
                href={`/jobs?status=${status}`}
                className="card flex flex-col items-center gap-1 px-2 py-3.5 transition-colors hover:border-accent/40"
              >
                <span className="text-xl font-semibold text-stone-900">
                  {counts.get(status) ?? 0}
                </span>
                <span className="text-center text-[11px] leading-tight text-stone-500">
                  {JOB_STATUS_LABELS[status]}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Follow-ups */}
        <section
          className="card p-5"
          aria-label="Follow-ups due this week"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <CalendarClock className="h-4 w-4 text-accent" aria-hidden />
            Follow-ups due this week
          </h2>
          {followUps.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">
              No follow-ups due. Set a follow-up date on any job from the table
              view or the job page.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {followUps.map((job) => {
                const isOverdue = (job.follow_up_date ?? "") < todayIso;
                return (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2 hover:border-accent/40"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-stone-800">
                        {job.title ?? "Untitled role"}
                        <span className="text-stone-400">
                          {job.company ? ` · ${job.company}` : ""}
                        </span>
                      </span>
                      <span
                        className={
                          isOverdue
                            ? "chip !border-red-200 !bg-red-50 !text-red-700"
                            : "chip"
                        }
                      >
                        {isOverdue ? "overdue: " : ""}
                        {job.follow_up_date}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Stale jobs */}
        <section className="card p-5" aria-label="Jobs with no activity for 7 days">
          <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <AlarmClock className="h-4 w-4 text-accent" aria-hidden />
            No activity for 7 days
          </h2>
          {stale.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">
              Nothing is going stale. Every active job moved within the last
              week.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stale.map((job: Job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2 hover:border-accent/40"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-stone-800">
                      {job.title ?? "Untitled role"}
                      <span className="text-stone-400">
                        {job.company ? ` · ${job.company}` : ""}
                      </span>
                    </span>
                    <span className="chip">
                      {JOB_STATUS_LABELS[job.status]} · since{" "}
                      {job.status_updated_at.slice(0, 10)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-stone-400">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          The goal is interviews and jobs. If a job has been sitting in Saved
          for a week, either tailor it this week or close it.
        </p>
      </div>
    </>
  );
}
