import type { ServiceInterval, VehicleEvent, ZoneId } from "./types";
import type { ZoneState } from "@/components/BikeDiagram";

export type ScheduleRow = {
  interval: ServiceInterval;
  lastHours: number | null;
  lastDate: string | null;
  dueAt: number | null;
  remaining: number | null; // hours left; negative = overdue
};

export function buildSchedule(intervals: ServiceInterval[], events: VehicleEvent[], currentHours: number | null): ScheduleRow[] {
  return intervals
    .map((interval) => {
      const done = events
        .filter((e) => e.kind !== "plan" && e.taskKey === interval.taskKey)
        .sort((a, b) => (b.engineHours ?? -1) - (a.engineHours ?? -1) || (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
      const last = done[0];
      const lastHours = last?.engineHours ?? null;
      // Never-logged tasks have no due point yet (we don't know when they were last done).
      const dueAt = last && interval.intervalHours != null ? (lastHours ?? 0) + Number(interval.intervalHours) : null;
      const remaining = dueAt != null && currentHours != null ? Math.round((dueAt - currentHours) * 10) / 10 : null;
      return { interval, lastHours, lastDate: last?.eventDate ?? null, dueAt, remaining };
    })
    .sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity));
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
