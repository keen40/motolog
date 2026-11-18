"use server";

import { and, eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema as s } from "@/db";
import { requireVehicle } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { deletePhotos, savePhotos } from "@/lib/photos";
import type { EventKind, PartLine, PlanStatus } from "@/lib/types";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const files = (fd: FormData, k: string) => fd.getAll(k).filter((f): f is File => typeof f !== "string");

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function createVehicle(formData: FormData) {
  const user = await requireUser();
  const db = getDb();
  const modelId = str(formData, "model_id");

  let make = str(formData, "make");
  let model = str(formData, "model");
  let year = num(formData, "year");
  if (modelId) {
    const m = db.select().from(s.vehicleModels).where(eq(s.vehicleModels.id, modelId)).get();
    if (m) {
      make = m.make;
      model = m.model;
      year = year ?? m.yearFrom;
    }
  }
  if (!make || !model || !year) throw new Error("Make, model and year are required");

  const vehicle = db
    .insert(s.vehicles)
    .values({
      ownerId: user.id,
      modelId,
      make,
      model,
      year,
      nickname: str(formData, "nickname"),
      vin: str(formData, "vin"),
      engineHours: num(formData, "engine_hours"),
      odometerKm: num(formData, "odometer_km"),
      purchaseDate: str(formData, "purchase_date"),
      notes: str(formData, "notes"),
    })
    .returning()
    .get();

  const [photoId] = await savePhotos(files(formData, "photo"), { vehicleId: vehicle.id, userId: user.id });
  if (photoId) db.update(s.vehicles).set({ photoId }).where(eq(s.vehicles.id, vehicle.id)).run();

  revalidatePath("/garage");
  redirect(`/garage/${vehicle.id}`);
}

export async function updateVehicleHours(vehicleId: string, formData: FormData) {
  await requireVehicle(vehicleId, "editor");
  getDb()
    .update(s.vehicles)
    .set({ engineHours: num(formData, "engine_hours"), odometerKm: num(formData, "odometer_km") })
    .where(eq(s.vehicles.id, vehicleId))
    .run();
  revalidatePath(`/garage/${vehicleId}`);
}

export async function deleteVehicle(vehicleId: string) {
  await requireVehicle(vehicleId, "owner");
  const db = getDb();
  const photoIds = db.select({ id: s.photos.id }).from(s.photos).where(eq(s.photos.vehicleId, vehicleId)).all().map((p) => p.id);
  await deletePhotos(photoIds);
  db.delete(s.vehicles).where(eq(s.vehicles.id, vehicleId)).run();
  revalidatePath("/garage");
  redirect("/garage");
}

// ---------------------------------------------------------------------------
// Sharing (owner only)
// ---------------------------------------------------------------------------

export async function shareVehicle(vehicleId: string, formData: FormData) {
  const { user } = await requireVehicle(vehicleId, "owner");
  const email = str(formData, "email")?.toLowerCase();
  const role = str(formData, "role") === "editor" ? "editor" : "viewer";
  if (!email || email === user.email) return;
  getDb()
    .insert(s.vehicleShares)
    .values({ vehicleId, email, role })
    .onConflictDoUpdate({ target: [s.vehicleShares.vehicleId, s.vehicleShares.email], set: { role } })
    .run();
  revalidatePath(`/garage/${vehicleId}`);
}

export async function unshareVehicle(vehicleId: string, email: string) {
  await requireVehicle(vehicleId, "owner");
  getDb()
    .delete(s.vehicleShares)
    .where(and(eq(s.vehicleShares.vehicleId, vehicleId), eq(s.vehicleShares.email, email)))
    .run();
  revalidatePath(`/garage/${vehicleId}`);
}

// ---------------------------------------------------------------------------
// Events (service / mod / repair / plan)
// ---------------------------------------------------------------------------

export async function saveEvent(vehicleId: string, eventId: string | null, formData: FormData) {
  const { user, vehicle } = await requireVehicle(vehicleId, "editor");
  const db = getDb();

  let parts: PartLine[] = [];
  try {
    parts = (JSON.parse(String(formData.get("parts") ?? "[]")) as PartLine[]).filter((p) => p.name?.trim());
  } catch {
    parts = [];
  }

  const kind = (str(formData, "kind") ?? "service") as EventKind;
  const row = {
    vehicleId,
    kind,
    planStatus: kind === "plan" ? ((str(formData, "plan_status") ?? "idea") as PlanStatus) : null,
    zone: str(formData, "zone") ?? "other",
    taskKey: str(formData, "task_key"),
    title: str(formData, "title") ?? "—",
    description: str(formData, "description"),
    eventDate: kind === "plan" ? null : str(formData, "event_date"),
    engineHours: num(formData, "engine_hours"),
    odometerKm: num(formData, "odometer_km"),
    // Empty cost falls back to the sum of part prices.
    cost: num(formData, "cost") ?? (parts.some((p) => p.price) ? parts.reduce((sum, p) => sum + (p.price ?? 0) * (p.qty ?? 1), 0) : null),
    currency: str(formData, "currency") ?? "HUF",
    parts,
  };

  let id = eventId;
  if (eventId) {
    const existing = db.select().from(s.vehicleEvents).where(and(eq(s.vehicleEvents.id, eventId), eq(s.vehicleEvents.vehicleId, vehicleId))).get();
    if (!existing) throw new Error("Entry not found");
    // An installed plan stays "done" when edited, so it keeps showing in the plan board's last column.
    if (kind !== "plan" && existing.planStatus === "done") row.planStatus = "done";
    db.update(s.vehicleEvents).set(row).where(eq(s.vehicleEvents.id, eventId)).run();

    const keep = formData.getAll("keep_photo").map(String);
    const removed = db
      .select({ id: s.photos.id })
      .from(s.photos)
      .where(and(eq(s.photos.eventId, eventId), keep.length ? notInArray(s.photos.id, keep) : undefined))
      .all()
      .map((p) => p.id);
    await deletePhotos(removed);
  } else {
    id = db.insert(s.vehicleEvents).values({ ...row, authorId: user.id }).returning({ id: s.vehicleEvents.id }).get().id;
  }
  await savePhotos(files(formData, "photos"), { vehicleId, eventId: id, userId: user.id });

  // Keep the bike's current hours/km up to date with the newest entry.
  const patch: Partial<typeof s.vehicles.$inferInsert> = {};
  if (row.engineHours !== null && (vehicle.engineHours ?? 0) < row.engineHours) patch.engineHours = row.engineHours;
  if (row.odometerKm !== null && (vehicle.odometerKm ?? 0) < row.odometerKm) patch.odometerKm = row.odometerKm;
  if (Object.keys(patch).length) db.update(s.vehicles).set(patch).where(eq(s.vehicles.id, vehicleId)).run();

  revalidatePath(`/garage/${vehicleId}`);
  redirect(`/garage/${vehicleId}?tab=${kind === "plan" ? "plans" : "timeline"}`);
}

export async function deleteEvent(vehicleId: string, eventId: string) {
  await requireVehicle(vehicleId, "editor");
  const db = getDb();
  const photoIds = db.select({ id: s.photos.id }).from(s.photos).where(eq(s.photos.eventId, eventId)).all().map((p) => p.id);
  await deletePhotos(photoIds);
  db.delete(s.vehicleEvents).where(and(eq(s.vehicleEvents.id, eventId), eq(s.vehicleEvents.vehicleId, vehicleId))).run();
  revalidatePath(`/garage/${vehicleId}`);
  redirect(`/garage/${vehicleId}?tab=timeline`);
}

/** Moves a plan card between columns. Moving to "done" turns it into a modification entry. */
export async function setPlanStatus(vehicleId: string, eventId: string, status: PlanStatus) {
  await requireVehicle(vehicleId, "editor");
  const patch =
    status === "done"
      ? { planStatus: "done" as const, kind: "mod" as const, eventDate: new Date().toISOString().slice(0, 10) }
      : { planStatus: status, kind: "plan" as const };
  getDb()
    .update(s.vehicleEvents)
    .set(patch)
    .where(and(eq(s.vehicleEvents.id, eventId), eq(s.vehicleEvents.vehicleId, vehicleId)))
    .run();
  revalidatePath(`/garage/${vehicleId}`);
}

// ---------------------------------------------------------------------------
// Shared catalogue: anyone on the server can confirm/add specs and suggest parts
// ---------------------------------------------------------------------------

export async function toggleSpecVerification(vehicleId: string, specId: string, verified: boolean) {
  const user = await requireUser();
  const db = getDb();
  if (verified) {
    db.delete(s.specVerifications).where(and(eq(s.specVerifications.specId, specId), eq(s.specVerifications.userId, user.id))).run();
  } else {
    db.insert(s.specVerifications).values({ specId, userId: user.id }).onConflictDoNothing().run();
  }
  revalidatePath(`/garage/${vehicleId}`);
}

export async function addSpec(vehicleId: string, modelId: string, formData: FormData) {
  const user = await requireUser();
  const label = str(formData, "label");
  const value = str(formData, "value");
  if (!label || !value) return;
  getDb()
    .insert(s.modelSpecs)
    .values({ modelId, specGroup: str(formData, "spec_group") ?? "engine", labelEn: label, labelHu: label, value, source: str(formData, "source"), createdBy: user.id })
    .run();
  revalidatePath(`/garage/${vehicleId}`);
}

export async function updateSpecValue(vehicleId: string, specId: string, formData: FormData) {
  const user = await requireUser();
  const value = str(formData, "value");
  if (!value) return;
  const db = getDb();
  db.update(s.modelSpecs).set({ value, source: str(formData, "source"), isSeed: false, createdBy: user.id }).where(eq(s.modelSpecs.id, specId)).run();
  // A changed value needs to be confirmed again.
  db.delete(s.specVerifications).where(eq(s.specVerifications.specId, specId)).run();
  db.insert(s.specVerifications).values({ specId, userId: user.id }).run();
  revalidatePath(`/garage/${vehicleId}`);
}

export async function addFitmentPart(vehicleId: string, modelId: string, formData: FormData) {
  const user = await requireUser();
  const brand = str(formData, "brand");
  const name = str(formData, "name");
  if (!brand || !name) return;
  const infoUrl = str(formData, "info_url");
  getDb()
    .insert(s.fitmentParts)
    .values({
      modelId,
      zone: str(formData, "zone") ?? "other",
      category: str(formData, "category") ?? name,
      brand,
      name,
      partNumber: str(formData, "part_number"),
      searchQuery: str(formData, "search_query") ?? `${brand} ${name}`,
      infoUrl: infoUrl && /^https?:\/\//i.test(infoUrl) ? infoUrl : null,
      createdBy: user.id,
    })
    .run();
  revalidatePath(`/garage/${vehicleId}`);
}

export async function deleteFitmentPart(vehicleId: string, partId: string) {
  await requireUser();
  getDb().delete(s.fitmentParts).where(and(eq(s.fitmentParts.id, partId), eq(s.fitmentParts.isSeed, false))).run();
  revalidatePath(`/garage/${vehicleId}`);
}
