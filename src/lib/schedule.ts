import type { ServiceInterval, VehicleEvent, ZoneId } from "./types";
import type { ZoneState } from "@/components/BikeDiagram";

export type ScheduleRow = {
  interval: ServiceInterval;
  lastHours: number | null;
  lastDate: string | null;
  /** Engine hours at which the task is due (hour-based intervals). */
  dueAt: number | null;
  /** Hours left; negative = overdue. */
  remaining: number | null;
  /** Date the task is due (time-based intervals, e.g. coolant every 2 years). */
  dueDate: string | null;
  /** Days left; negative = overdue. */
  daysLeft: number | null;
  overdue: boolean;
  /** 0–100: how much of the interval is used up (whichever limit is closer). */
  used: number | null;
};

const DAY = 24 * 60 * 60 * 1000;

function addMonths(date: string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildSchedule(
  intervals: ServiceInterval[],
  events: VehicleEvent[],
  currentHours: number | null,
  today: Date = new Date(),
): ScheduleRow[] {
  return intervals
    .map((interval) => {
      const done = events.filter((e) => e.kind !== "plan" && e.taskKey === interval.taskKey);
      const byHours = [...done].sort((a, b) => (b.engineHours ?? -1) - (a.engineHours ?? -1) || (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
      const byDate = [...done].sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
      const last = byHours[0];
      const lastHours = last?.engineHours ?? null;
      const lastDate = byDate[0]?.eventDate ?? last?.eventDate ?? null;
      const hoursEvery = interval.intervalHours != null ? Number(interval.intervalHours) : null;
      const monthsEvery = interval.intervalMonths ?? null;

      // Never-logged tasks have no due point yet (we don't know when they were last done).
      const dueAt = last && hoursEvery != null ? (lastHours ?? 0) + hoursEvery : null;
      const remaining = dueAt != null && currentHours != null ? Math.round((dueAt - currentHours) * 10) / 10 : null;

      const dueDate = lastDate && monthsEvery != null ? addMonths(lastDate, monthsEvery) : null;
      const daysLeft = dueDate ? Math.round((new Date(dueDate).getTime() - today.getTime()) / DAY) : null;

      const usedH = remaining != null && hoursEvery ? ((hoursEvery - remaining) / hoursEvery) * 100 : null;
      const usedD = daysLeft != null && monthsEvery ? ((monthsEvery * 30.4 - daysLeft) / (monthsEvery * 30.4)) * 100 : null;
      const usedRaw = usedH == null ? usedD : usedD == null ? usedH : Math.max(usedH, usedD);
      const used = usedRaw == null ? null : Math.min(100, Math.max(0, usedRaw));
      const overdue = (remaining != null && remaining < 0) || (daysLeft != null && daysLeft < 0);

      return { interval, lastHours, lastDate, dueAt, remaining, dueDate, daysLeft, overdue, used };
    })
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (b.used ?? -1) - (a.used ?? -1));
}

/** Diagram colour per zone: modified wins over serviced, which wins over planned. */
export function zoneStates(events: VehicleEvent[]) {
  const rank: Record<ZoneState, number> = { stock: 0, planned: 1, serviced: 2, modified: 3 };
  const states: Partial<Record<ZoneId, ZoneState>> = {};
  const counts: Partial<Record<ZoneId, number>> = {};
  for (const e of events) {
    const s: ZoneState = e.kind === "mod" ? "modified" : e.kind === "plan" ? "planned" : "serviced";
    if (rank[s] > rank[states[e.zone] ?? "stock"]) states[e.zone] = s;
    counts[e.zone] = (counts[e.zone] ?? 0) + 1;
  }
  return { states, counts };
}
