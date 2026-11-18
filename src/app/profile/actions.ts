"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, PHOTO_DIR, schema as s } from "@/db";
import { isAdmin, requireUser, type User } from "@/lib/auth";
import { identityAliases } from "@/lib/cfAccess";
import { addGuestEmail, cfApiConfig, removeGuestEmail } from "@/lib/cfApi";

const AVATAR_DIR = path.join(/*turbopackIgnore: true*/ PHOTO_DIR, "avatars");
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

async function removeAvatarFile(file: string | null) {
  if (file) await fs.rm(path.join(AVATAR_DIR, path.basename(file)), { force: true });
}

export async function saveProfile(formData: FormData) {
  const user = await requireUser();
  const db = getDb();
  const name = text(formData, "name").slice(0, 60) || user.name;

  let avatarFile = user.avatarFile;
  const upload = formData.get("avatar");
  if (upload && typeof upload !== "string" && upload.size > 0 && AVATAR_TYPES[upload.type] && upload.size < 5_000_000) {
    await fs.mkdir(AVATAR_DIR, { recursive: true });
    const file = `${user.id}-${crypto.randomUUID().slice(0, 8)}.${AVATAR_TYPES[upload.type]}`;
    await fs.writeFile(path.join(AVATAR_DIR, file), Buffer.from(await upload.arrayBuffer()));
    await removeAvatarFile(avatarFile);
    avatarFile = file;
  } else if (formData.get("remove_avatar")) {
    await removeAvatarFile(avatarFile);
    avatarFile = null;
  }

  db.update(s.users).set({ name, avatarFile, profileDone: true }).where(eq(s.users.id, user.id)).run();

  const lang = text(formData, "lang");
  if (lang === "hu" || lang === "en") (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/", "layout");
  redirect(formData.get("welcome") ? "/garage" : "/profile?saved=1");
}

export async function skipProfile() {
  const user = await requireUser();
  getDb().update(s.users).set({ profileDone: true }).where(eq(s.users.id, user.id)).run();
  redirect("/garage");
}

// ---------------------------------------------------------------------------
// Guest list (admins only)
// ---------------------------------------------------------------------------

export type InviteState = { ok?: string; error?: string; errorKey?: "invalidEmail" | "cantRemoveSelf" };

/** E-mails that are this user (their login, and any Cloudflare e-mail aliased to it). */
function ownEmails(user: User) {
  const mine = [user.email.toLowerCase()];
  for (const [from, to] of identityAliases()) if (to === user.email.toLowerCase()) mine.push(from);
  return mine;
}

async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) throw new Error("Only admins can manage the guest list");
  return user;
}

export async function inviteGuest(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireAdmin();
  const email = text(formData, "email").toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return { errorKey: "invalidEmail" };

  if (cfApiConfig()) {
    try {
      await addGuestEmail(email);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const db = getDb();
  db.insert(s.invites).values({ email, invitedBy: user.id }).onConflictDoNothing().run();

  // Optionally share some of the inviter's own bikes right away.
  const role = text(formData, "role") === "editor" ? "editor" : "viewer";
  const bikeIds = formData.getAll("share_bike").filter((v): v is string => typeof v === "string");
  if (bikeIds.length) {
    const own = db
      .select({ id: s.vehicles.id })
      .from(s.vehicles)
      .where(and(eq(s.vehicles.ownerId, user.id), inArray(s.vehicles.id, bikeIds)))
      .all();
    // Share with the identity they will actually have in the app (alias target if one is configured).
    const target = identityAliases().get(email) ?? email;
    for (const v of own) {
      db.insert(s.vehicleShares)
        .values({ vehicleId: v.id, email: target, role })
        .onConflictDoUpdate({ target: [s.vehicleShares.vehicleId, s.vehicleShares.email], set: { role } })
        .run();
    }
  }

  revalidatePath("/profile");
  return { ok: email };
}

export async function removeGuest(email: string): Promise<InviteState> {
  const user = await requireAdmin();
  const e = email.trim().toLowerCase();
  if (ownEmails(user).includes(e)) return { errorKey: "cantRemoveSelf" };

  if (cfApiConfig()) {
    try {
      await removeGuestEmail(e);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  const db = getDb();
  db.delete(s.invites).where(eq(s.invites.email, e)).run();
  // Take back shares of this admin's bikes; the guest's own data stays.
  const mine = db.select({ id: s.vehicles.id }).from(s.vehicles).where(eq(s.vehicles.ownerId, user.id)).all().map((v) => v.id);
  const target = identityAliases().get(e) ?? e;
  if (mine.length) db.delete(s.vehicleShares).where(and(inArray(s.vehicleShares.vehicleId, mine), inArray(s.vehicleShares.email, [e, target]))).run();

  revalidatePath("/profile");
  return {};
}
