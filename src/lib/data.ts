import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { Role } from "./access";
import type { User } from "./auth";
import type { FitmentPart, ModelSpec, ServiceInterval, Shop, VehicleEvent, VehicleModel } from "./types";

export type GarageVehicle = typeof s.vehicles.$inferSelect & {
  role: Role;
  ownerName: string | null;
  doneCount: number;
  spent: { currency: string; total: number }[];
};

/** Bikes the user owns plus bikes shared with them. */
export function listGarage(user: User): GarageVehicle[] {
  const db = getDb();
  const owned = db.select().from(s.vehicles).where(eq(s.vehicles.ownerId, user.id)).orderBy(asc(s.vehicles.createdAt)).all();
  const shared = db
    .select({ v: s.vehicles, role: s.vehicleShares.role, ownerName: s.users.name, ownerEmail: s.users.email })
    .from(s.vehicleShares)
    .innerJoin(s.vehicles, eq(s.vehicles.id, s.vehicleShares.vehicleId))
    .innerJoin(s.users, eq(s.users.id, s.vehicles.ownerId))
    .where(eq(s.vehicleShares.email, user.email))
    .all();

  const all = [
    ...owned.map((v) => ({ ...v, role: "owner" as Role, ownerName: null })),
    ...shared.map((r) => ({ ...r.v, role: r.role as Role, ownerName: r.ownerName ?? r.ownerEmail })),
  ];
  if (!all.length) return [];

  const ids = all.map((v) => v.id);
  const counts = db
    .select({ vehicleId: s.vehicleEvents.vehicleId, n: sql<number>`count(*)` })
    .from(s.vehicleEvents)
    .where(sql`${s.vehicleEvents.vehicleId} in ${ids} and ${s.vehicleEvents.kind} != 'plan'`)
    .groupBy(s.vehicleEvents.vehicleId)
    .all();
  const spent = db
    .select({ vehicleId: s.vehicleEvents.vehicleId, currency: s.vehicleEvents.currency, total: sql<number>`sum(${s.vehicleEvents.cost})` })
    .from(s.vehicleEvents)
    .where(sql`${s.vehicleEvents.vehicleId} in ${ids} and ${s.vehicleEvents.kind} != 'plan' and ${s.vehicleEvents.cost} is not null`)
    .groupBy(s.vehicleEvents.vehicleId, s.vehicleEvents.currency)
    .all();

  return all.map((v) => ({
    ...v,
    doneCount: counts.find((c) => c.vehicleId === v.id)?.n ?? 0,
    spent: spent.filter((x) => x.vehicleId === v.id).map(({ currency, total }) => ({ currency, total })),
  }));
}

export function loadEvents(vehicleId: string): VehicleEvent[] {
  const db = getDb();
  const rows = db
    .select({ e: s.vehicleEvents, authorName: s.users.name, authorEmail: s.users.email })
    .from(s.vehicleEvents)
    .leftJoin(s.users, eq(s.users.id, s.vehicleEvents.authorId))
    .where(eq(s.vehicleEvents.vehicleId, vehicleId))
    .orderBy(sql`${s.vehicleEvents.eventDate} is not null`, desc(s.vehicleEvents.eventDate), desc(s.vehicleEvents.createdAt))
    .all();
  const photos = db
    .select({ id: s.photos.id, eventId: s.photos.eventId })
    .from(s.photos)
    .where(eq(s.photos.vehicleId, vehicleId))
    .orderBy(asc(s.photos.createdAt))
    .all();
  return rows.map(({ e, authorName, authorEmail }) => ({
    ...e,
    zone: e.zone as VehicleEvent["zone"],
    photoIds: photos.filter((p) => p.eventId === e.id).map((p) => p.id),
    authorName: authorName ?? authorEmail ?? null,
  }));
}

export function loadEvent(vehicleId: string, eventId: string): VehicleEvent | null {
  return loadEvents(vehicleId).find((e) => e.id === eventId) ?? null;
}

export function listModels() {
  return getDb()
    .select({ id: s.vehicleModels.id, make: s.vehicleModels.make, model: s.vehicleModels.model, yearFrom: s.vehicleModels.yearFrom, yearTo: s.vehicleModels.yearTo, engineCc: s.vehicleModels.engineCc })
    .from(s.vehicleModels)
    .where(eq(s.vehicleModels.vehicleType, "motorcycle"))
    .orderBy(asc(s.vehicleModels.make), asc(s.vehicleModels.model), asc(s.vehicleModels.yearFrom))
    .all();
}

export function loadModel(modelId: string | null): VehicleModel | null {
  if (!modelId) return null;
  return getDb().select().from(s.vehicleModels).where(eq(s.vehicleModels.id, modelId)).get() ?? null;
}

export function loadSpecs(modelId: string): ModelSpec[] {
  const db = getDb();
  const specs = db.select().from(s.modelSpecs).where(eq(s.modelSpecs.modelId, modelId)).orderBy(asc(s.modelSpecs.createdAt)).all();
  const ver = specs.length
    ? db.select().from(s.specVerifications).where(inArray(s.specVerifications.specId, specs.map((x) => x.id))).all()
    : [];
  return specs.map((x) => ({ ...x, verifiedBy: ver.filter((v) => v.specId === x.id).map((v) => v.userId) }));
}

export function loadIntervals(modelId: string | null): ServiceInterval[] {
  if (!modelId) return [];
  return getDb().select().from(s.serviceIntervals).where(eq(s.serviceIntervals.modelId, modelId)).all() as ServiceInterval[];
}

export function loadParts(modelId: string): FitmentPart[] {
  return getDb()
    .select()
    .from(s.fitmentParts)
    .where(eq(s.fitmentParts.modelId, modelId))
    .orderBy(asc(s.fitmentParts.zone), asc(s.fitmentParts.category))
    .all() as FitmentPart[];
}

export function loadShops(): Shop[] {
  return getDb().select().from(s.shops).orderBy(asc(s.shops.sortOrder)).all();
}

export function loadShares(vehicleId: string) {
  const db = getDb();
  return db
    .select({ email: s.vehicleShares.email, role: s.vehicleShares.role, name: s.users.name })
    .from(s.vehicleShares)
    .leftJoin(s.users, eq(s.users.email, s.vehicleShares.email))
    .where(eq(s.vehicleShares.vehicleId, vehicleId))
    .orderBy(asc(s.vehicleShares.createdAt))
    .all();
}

/** Everyone who has opened the app – used as suggestions when sharing. */
export function listKnownUsers() {
  return getDb().select({ email: s.users.email, name: s.users.name }).from(s.users).orderBy(asc(s.users.email)).all();
}
