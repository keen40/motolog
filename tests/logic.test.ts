import { describe, expect, it } from "vitest";
import { dedupeIntervals, hoursPerRace, intervalHours } from "@/lib/ai/lookup";
import { decodeHeaderValue } from "@/lib/auth";
import en from "@/lib/i18n/en";
import { parseRatio } from "@/lib/premix";
import { buildSchedule } from "@/lib/schedule";
import { dueText, intervalText } from "@/lib/scheduleText";
import { diffSettings, normalize, sameValue, withChanges } from "@/lib/tuning";
import type { ServiceInterval, TuningSheet, VehicleEvent } from "@/lib/types";

const interval = (over: Partial<ServiceInterval>): ServiceInterval => ({
  id: over.taskKey ?? "i",
  taskKey: "task",
  zone: "engine",
  labelEn: "Task",
  labelHu: "Feladat",
  intervalHours: null,
  intervalKm: null,
  intervalMonths: null,
  notesEn: null,
  notesHu: null,
  ...over,
});

const event = (over: Partial<VehicleEvent>): VehicleEvent => ({
  id: Math.random().toString(36),
  vehicleId: "v",
  kind: "service",
  planStatus: null,
  zone: "engine",
  taskKey: null,
  title: "x",
  description: null,
  eventDate: null,
  engineHours: null,
  odometerKm: null,
  cost: null,
  currency: "HUF",
  parts: [],
  photoIds: [],
  authorName: null,
  createdAt: "2026-01-01",
  ...over,
});

describe("service schedule", () => {
  const today = new Date("2026-11-18T12:00:00Z");

  it("has no due point for a task that was never logged", () => {
    const [row] = buildSchedule([interval({ taskKey: "plug", intervalHours: 10 })], [], 45, today);
    expect(row.dueAt).toBeNull();
    expect(row.remaining).toBeNull();
    expect(row.overdue).toBe(false);
    expect(dueText(row, en)).toBe(en.stats.never);
  });

  it("counts hours from the last time the task was done", () => {
    const i = interval({ taskKey: "fork_oil", intervalHours: 10 });
    const done = [event({ taskKey: "fork_oil", engineHours: 30 }), event({ taskKey: "fork_oil", engineHours: 40 })];
    const [ok] = buildSchedule([i], done, 45, today);
    expect(ok.dueAt).toBe(50);
    expect(ok.remaining).toBe(5);
    expect(ok.overdue).toBe(false);
    const [late] = buildSchedule([i], done, 52, today);
    expect(late.remaining).toBe(-2);
    expect(late.overdue).toBe(true);
    expect(dueText(late, en)).toBe("overdue (2 h)");
  });

  it("ignores plans when finding the last time a task was done", () => {
    const [row] = buildSchedule([interval({ taskKey: "chain", intervalHours: 2 })], [event({ kind: "plan", taskKey: "chain", engineHours: 44 })], 45, today);
    expect(row.dueAt).toBeNull();
  });

  it("handles time-based intervals (coolant every 2 years)", () => {
    const i = interval({ taskKey: "coolant", intervalMonths: 24 });
    const [row] = buildSchedule([i], [event({ taskKey: "coolant", eventDate: "2025-01-10" })], null, today);
    expect(row.dueDate).toBe("2027-01-10");
    expect(row.daysLeft).toBe(53);
    expect(row.overdue).toBe(false);
    expect(dueText(row, en)).toBe("in 53 days");

    const [old] = buildSchedule([i], [event({ taskKey: "coolant", eventDate: "2024-09-01" })], null, today);
    expect(old.overdue).toBe(true);
  });

  it("puts overdue tasks first", () => {
    const rows = buildSchedule(
      [interval({ taskKey: "a", intervalHours: 100 }), interval({ taskKey: "b", intervalHours: 2 })],
      [event({ taskKey: "a", engineHours: 40 }), event({ taskKey: "b", engineHours: 40 })],
      45,
      today,
    );
    expect(rows.map((r) => r.interval.taskKey)).toEqual(["b", "a"]);
  });

  it("describes intervals in words", () => {
    expect(intervalText(interval({ intervalMonths: 12 }), en)).toBe("1 year");
    expect(intervalText(interval({ intervalMonths: 24 }), en)).toBe("2 years");
    expect(intervalText(interval({ intervalHours: 10, intervalMonths: 12 }), en)).toBe("10 h or 1 year");
  });
});

describe("tuning sheet comparison", () => {
  it("treats the same number written differently as equal", () => {
    expect(normalize("1,5")).toBe("1.5");
    expect(sameValue("1.0", "1")).toBe(true);
    expect(sameValue(" NGK BR9EG ", "ngk br9eg")).toBe(true);
    expect(sameValue("450", "440")).toBe(false);
  });

  it("lists only settings that changed", () => {
    const changes = diffSettings({ main_jet: "450", clip: "3", fork_comp: "12" }, { main_jet: "440", clip: "3", fork_comp: "12.0", fork_reb: "10" });
    expect(changes.map((c) => [c.field.key, c.from, c.to])).toEqual([
      ["main_jet", "450", "440"],
      ["fork_reb", "", "10"],
    ]);
  });

  it("pairs each sheet with the changes since the one before it", () => {
    const sheet = (id: string, settings: Record<string, string>) => ({ id, settings }) as unknown as TuningSheet;
    const out = withChanges([sheet("new", { main_jet: "440" }), sheet("old", { main_jet: "450" })]);
    expect(out[0].changes?.[0].to).toBe("440");
    expect(out[1].changes).toBeNull();
  });
});

describe("premix ratio", () => {
  it.each([
    ["30:1", 30],
    ["32 : 1", 32],
    ["1:40", 40],
    ["50:1 (Motul)", 50],
    ["abc", null],
    ["5:1", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(parseRatio(input)).toBe(expected);
  });
});

describe("AI interval maths", () => {
  it("converts races to hours with the manual's own figure", () => {
    expect(intervalHours({ hours: null, every_races: 5 })).toBe(10);
    expect(intervalHours({ hours: null, every_races: 5 }, 2.5)).toBe(12.5);
    expect(intervalHours({ hours: 20, every_races: null })).toBe(20);
  });

  it("only trusts a sensible hours-per-race figure", () => {
    expect(hoursPerRace({ hours_per_race: 2.5 })).toBe(2.5);
    expect(hoursPerRace({ hours_per_race: null })).toBe(2);
    expect(hoursPerRace({ hours_per_race: 40 })).toBe(2);
  });

  it("keeps the longest interval when a task is listed twice (inspect vs replace)", () => {
    const out = dedupeIntervals([
      { task_key: "top_end", hours: null, every_races: 1, months: null },
      { task_key: "top_end", hours: null, every_races: 5, months: null },
      { task_key: "chain", hours: null, every_races: 1, months: null },
    ]);
    expect(out.find((x) => x.task_key === "top_end")?.every_races).toBe(5);
    expect(out).toHaveLength(2);
  });
});

describe("Tailscale identity headers", () => {
  it("decodes RFC 2047 encoded names", () => {
    expect(decodeHeaderValue("=?utf-8?q?Kov=C3=A1cs_Bal=C3=A1zs?=")).toBe("Kovács Balázs");
    expect(decodeHeaderValue("Plain Name")).toBe("Plain Name");
    expect(decodeHeaderValue(null)).toBeNull();
  });
});
