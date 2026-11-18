import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, schema as s } from "@/db";
import type { User } from "@/lib/auth";

// Server actions call Next.js helpers; replace them with plain functions.
let currentUser: User;
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<object>()), requireUser: async () => currentUser }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("REDIRECT"), { to });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { saveRide, deleteRide, saveTuningSheet } = await import("@/app/garage/actions");

const db = () => getDb();
const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};
/** Server actions end with redirect(); swallow that, rethrow anything else. */
const run = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if ((e as Error).message !== "REDIRECT") throw e;
  }
};
const hours = (id: string) => db().select().from(s.vehicles).where(eq(s.vehicles.id, id)).get()!.engineHours;

let owner: User, viewer: User, bikeId: string, otherBikeId: string;
beforeAll(() => {
  owner = db().insert(s.users).values({ email: "owner@test" }).returning().get();
  viewer = db().insert(s.users).values({ email: "viewer@test" }).returning().get();
  bikeId = db().insert(s.vehicles).values({ ownerId: owner.id, make: "Yamaha", model: "YZ125", year: 2001, engineHours: 45 }).returning().get().id;
  otherBikeId = db().insert(s.vehicles).values({ ownerId: owner.id, make: "Honda", model: "CR250R", year: 1999 }).returning().get().id;
  db().insert(s.vehicleShares).values({ vehicleId: bikeId, email: "viewer@test", role: "viewer" }).run();
});
beforeEach(() => {
  currentUser = owner;
});

describe("ride log keeps engine hours in sync", () => {
  it("adds, adjusts and removes a ride's time", async () => {
    await run(saveRide(bikeId, null, form({ ride_date: "2026-11-18", duration_h: "1.5", track: "Szada MX" })));
    expect(hours(bikeId)).toBe(46.5);

    const ride = db().select().from(s.rides).where(eq(s.rides.vehicleId, bikeId)).get()!;
    expect(ride.track).toBe("Szada MX");
    expect(ride.authorId).toBe(owner.id);

    await run(saveRide(bikeId, ride.id, form({ ride_date: "2026-11-18", duration_h: "2" })));
    expect(hours(bikeId)).toBe(47);

    await run(deleteRide(bikeId, ride.id));
    expect(hours(bikeId)).toBe(45);
    expect(db().select().from(s.rides).where(eq(s.rides.vehicleId, bikeId)).all()).toHaveLength(0);
  });

  it("accepts a decimal comma and starts from 0 h when hours were never set", async () => {
    await run(saveRide(otherBikeId, null, form({ ride_date: "2026-11-18", duration_h: "1,2" })));
    expect(hours(otherBikeId)).toBe(1.2);
  });

  it("rejects impossible durations without touching the hours", async () => {
    const before = hours(bikeId);
    await expect(saveRide(bikeId, null, form({ duration_h: "0" }))).rejects.toThrow();
    await expect(saveRide(bikeId, null, form({ duration_h: "25" }))).rejects.toThrow();
    expect(hours(bikeId)).toBe(before);
  });

  it("ignores a tuning sheet that belongs to another bike", async () => {
    const foreign = db().insert(s.tuningSheets).values({ vehicleId: otherBikeId, title: "Other bike" }).returning().get();
    await run(saveRide(bikeId, null, form({ ride_date: "2026-11-19", duration_h: "1", tuning_sheet_id: foreign.id })));
    const ride = db().select().from(s.rides).where(eq(s.rides.rideDate, "2026-11-19")).get()!;
    expect(ride.tuningSheetId).toBeNull();
    await run(deleteRide(bikeId, ride.id));
  });

  it("does not let a viewer log or delete rides", async () => {
    const before = hours(bikeId);
    currentUser = viewer;
    await expect(saveRide(bikeId, null, form({ duration_h: "1" }))).rejects.toThrow("NOT_FOUND");
    expect(hours(bikeId)).toBe(before);
  });
});

describe("tuning sheets", () => {
  it("stores only known settings, trimmed, with a valid rating", async () => {
    await run(saveTuningSheet(bikeId, null, form({ title: "Sand", set_main_jet: " 440 ", set_clip: "2", set_bogus: "x", rating: "9" })));
    const sheet = db().select().from(s.tuningSheets).where(eq(s.tuningSheets.title, "Sand")).get()!;
    expect(sheet.settings).toEqual({ main_jet: "440", clip: "2" });
    expect(sheet.rating).toBeNull();
    expect(sheet.authorId).toBe(owner.id);
  });

  it("does not let a viewer save a sheet", async () => {
    currentUser = viewer;
    await expect(saveTuningSheet(bikeId, null, form({ title: "Viewer's" }))).rejects.toThrow("NOT_FOUND");
    expect(db().select().from(s.tuningSheets).where(eq(s.tuningSheets.title, "Viewer's")).get()).toBeUndefined();
  });
});
