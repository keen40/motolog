import type { Dict } from "./i18n/en";
import type { ScheduleRow } from "./schedule";
import type { ServiceInterval } from "./types";

const fill = (s: string, n: number) => s.replace("{n}", String(n));

function monthsText(m: number, t: Dict) {
  if (m === 12) return t.stats.year;
  if (m % 12 === 0) return fill(t.stats.years, m / 12);
  return fill(t.stats.months, m);
}

/** "10 h", "2 years", "10 h or 1 year". */
export function intervalText(i: ServiceInterval, t: Dict) {
  const parts = [];
  if (i.intervalHours != null) parts.push(`${i.intervalHours} h`);
  if (i.intervalMonths != null) parts.push(monthsText(i.intervalMonths, t));
  return parts.join(` ${t.stats.or} `);
}

/** Short status: "in 4 h", "in 120 days", "overdue (3 h)", "never logged" or "". */
export function dueText(row: ScheduleRow, t: Dict) {
  const { remaining, daysLeft, overdue } = row;
  if (remaining == null && daysLeft == null) return row.lastDate || row.lastHours != null ? "" : t.stats.never;
  if (overdue) {
    const by = remaining != null && remaining < 0 ? `${-remaining} h` : fill(t.stats.days, -(daysLeft ?? 0));
    return `${t.stats.overdue} (${by})`;
  }
  // Show whichever limit comes first, roughly comparing hours with days is meaningless,
  // so prefer the one with the bigger share of the interval used.
  const hUsed = remaining != null && row.interval.intervalHours ? 1 - remaining / Number(row.interval.intervalHours) : -1;
  const dUsed = daysLeft != null && row.interval.intervalMonths ? 1 - daysLeft / (row.interval.intervalMonths * 30.4) : -1;
  return hUsed >= dUsed && remaining != null ? fill(t.stats.inHours, remaining) : fill(t.stats.inDays, daysLeft ?? 0);
}
