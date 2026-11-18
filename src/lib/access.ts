import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser, type User } from "./auth";

export type Role = "owner" | "editor" | "viewer";
const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function vehicleRole(user: User, vehicleId: string): { vehicle: typeof schema.vehicles.$inferSelect; role: Role } | null {
  const db = getDb();
  const vehicle = db.select().from(schema.vehicles).where(eq(schema.vehicles.id, vehicleId)).get();
  if (!vehicle) return null;
  if (vehicle.ownerId === user.id) return { vehicle, role: "owner" };
  const share = db
    .select()
    .from(schema.vehicleShares)
    .where(and(eq(schema.vehicleShares.vehicleId, vehicleId), eq(schema.vehicleShares.email, user.email)))
    .get();
  return share ? { vehicle, role: share.role } : null;
}

/** Loads a vehicle the current user may access with at least `min` rights; 404 otherwise. */
export async function requireVehicle(vehicleId: string, min: Role = "viewer") {
  const user = await requireUser();
  const access = vehicleRole(user, vehicleId);
  if (!access || RANK[access.role] < RANK[min]) notFound();
  return { user, ...access };
}

export function canEdit(role: Role) {
  return RANK[role] >= RANK.editor;
}
