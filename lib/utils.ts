/** Tiny class name joiner (keeps components readable without a dependency). */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Formats a YYYY-MM-DD string as "Nov 2026" without timezone drift.
 * Returns "" for null/empty input.
 */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(iso);
  if (!match) return iso;
  const [, year, month] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return iso;
  return `${MONTHS[monthIndex]} ${year}`;
}

/** "Mar 2024 - Present" style range for record entries and jobs. */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = formatMonthYear(start);
  const to = end ? formatMonthYear(end) : "Present";
  if (!from && !to) return "";
  if (from && to) return `${from} - ${to}`;
  return from || to;
}

/** "3 Nov 2026" for timestamps; "" when missing. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
