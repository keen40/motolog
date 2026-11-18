import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, schema as s } from "@/db";
import { seed, SEED_VERSION } from "@/db/seed";
import { vehicleRole } from "@/lib/access";

const db = () => getDb();
const yz125 = () => db().select().from(s.vehicleModels).where(and(eq(s.vehicleModels.make, "Yamaha"), eq(s.vehicleModels.model, "YZ125"))).get()!;
const spec = (key: string) => db().select().from(s.modelSpecs).where(and(eq(s.modelSpecs.modelId, yz125().id), eq(s.modelSpecs.seedKey, key))).get()!;
const reseed = () => {
  db().update(s.meta).set({ value: "0" }).where(eq(s.meta.key, "seed_version")).run();
  seed(db());
};

describe("first start", () => {
  it("migrates and seeds the YZ125 reference data", () => {
    const m = yz125();
    expect(m.dataOrigin).toBe("seed");
    expect(m.stockSetup?.values.main_jet).toBe("450");
    expect(db().select().from(s.modelSpecs).where(eq(s.modelSpecs.modelId, m.id)).all().length).toBeGreaterThan(30);
    expect(spec("plug_gap").value).toBe("0.5–0.6 mm");
    expect(db().select().from(s.meta).where(eq(s.meta.key, "seed_version")).get()?.value).toBe(SEED_VERSION);
  });
});

describe("re-seeding", () => {
  it("never overwrites a value a rider corrected", () => {
    const user = db().insert(s.users).values({ email: "rider@test" }).returning().get();
    db().update(s.modelSpecs).set({ value: "NGK BR8EG (mine)", isSeed: false, createdBy: user.id }).where(eq(s.modelSpecs.id, spec("plug").id)).run();
    reseed();
    expect(spec("plug").value).toBe("NGK BR8EG (mine)");
    expect(spec("plug").isSeed).toBe(false);
  });

  it("restores seed values that were changed outside the app, and clears their confirmations", () => {
    const user = db().insert(s.users).values({ email: "checker@test" }).returning().get();
    const gap = spec("plug_gap");
    db().update(s.modelSpecs).set({ value: "wrong" }).where(eq(s.modelSpecs.id, gap.id)).run();
    db().insert(s.specVerifications).values({ specId: gap.id, userId: user.id }).run();
    reseed();
    expect(spec("plug_gap").value).toBe("0.5–0.6 mm");
    expect(db().select().from(s.specVerifications).where(eq(s.specVerifications.specId, gap.id)).all()).toHaveLength(0);
  });

  it("keeps confirmations when the value didn't change", () => {
    const user = db().insert(s.users).values({ email: "confirm@test" }).returning().get();
    const tank = spec("tank");
    db().insert(s.specVerifications).values({ specId: tank.id, userId: user.id }).run();
    reseed();
    expect(db().select().from(s.specVerifications).where(eq(s.specVerifications.specId, tank.id)).all()).toHaveLength(1);
  });

  it("does nothing when the seed version is current", () => {
    const tank = spec("tank");
    db().update(s.modelSpecs).set({ value: "changed by test" }).where(eq(s.modelSpecs.id, tank.id)).run();
    seed(db());
    expect(spec("tank").value).toBe("changed by test");
    reseed();
  });
});

describe("access rules", () => {
  it("gives owner, editor and viewer roles and nothing to strangers", () => {
    const owner = db().insert(s.users).values({ email: "owner@test" }).returning().get();
    const editor = db().insert(s.users).values({ email: "editor@test" }).returning().get();
    const viewer = db().insert(s.users).values({ email: "viewer@test" }).returning().get();
    const stranger = db().insert(s.users).values({ email: "stranger@test" }).returning().get();
    const bike = db().insert(s.vehicles).values({ ownerId: owner.id, make: "Yamaha", model: "YZ125", year: 2001 }).returning().get();
    db().insert(s.vehicleShares).values({ vehicleId: bike.id, email: "editor@test", role: "editor" }).run();
    db().insert(s.vehicleShares).values({ vehicleId: bike.id, email: "viewer@test", role: "viewer" }).run();

    expect(vehicleRole(owner, bike.id)?.role).toBe("owner");
    expect(vehicleRole(editor, bike.id)?.role).toBe("editor");
    expect(vehicleRole(viewer, bike.id)?.role).toBe("viewer");
    expect(vehicleRole(stranger, bike.id)).toBeNull();
    expect(vehicleRole(owner, "no-such-bike")).toBeNull();
  });
});
