import type { HourLog } from "@/lib/data/queries/plan";

/** Weekly targets from the spec: 16 hours split across five categories. */
export const WEEKLY_TARGET_HOURS = 16;
export const EXAM_TARGET_HOURS = 8;
export const WEEKLY_WARNING_HOURS = 20;

export const HOUR_CATEGORIES: {
  key: HourLog["category"];
  label: string;
  target: number;
}[] = [
  { key: "technical_learning", label: "Technical learning", target: 5 },
  { key: "portfolio_projects", label: "Portfolio projects", target: 6 },
  { key: "live_platform", label: "Live platform (this app)", target: 2 },
  { key: "independent_research", label: "Independent research", target: 1 },
  { key: "career_development", label: "Career development", target: 2 },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday of the week containing the given date. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - ((dow + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The six week days Monday..Saturday; Sunday is rest and not schedulable. */
export function weekDays(monday: Date): { iso: string; label: string; isSunday: boolean }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return {
      iso: toDateIso(day),
      label: DAY_NAMES[i],
      isSunday: i === 6,
    };
  });
}

export function hoursFor(
  logs: HourLog[],
  iso: string,
  category: HourLog["category"],
): number {
  return logs
    .filter((l) => l.log_date === iso && l.category === category)
    .reduce((sum, l) => sum + Number(l.hours), 0);
}

export function weekTotalHours(logs: HourLog[], monday: Date): number {
  return weekDays(monday).reduce(
    (sum, day) =>
      sum +
      HOUR_CATEGORIES.reduce((s, c) => s + hoursFor(logs, day.iso, c.key), 0),
    0,
  );
}
