import "server-only";
import { inArray } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, PHOTO_DIR, schema } from "@/db";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif" };

export function photoUrl(id: string) {
  return `/photos/${id}`;
}

/** Saves uploaded images to disk and records them. Returns the new photo ids. */
export async function savePhotos(files: File[], opts: { vehicleId: string; eventId?: string | null; userId: string }) {
  const db = getDb();
  const ids: string[] = [];
  for (const file of files) {
    if (!file || typeof file === "string" || file.size === 0 || !EXT[file.type]) continue;
    const id = crypto.randomUUID();
    const filename = `${id}.${EXT[file.type]}`;
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ PHOTO_DIR, filename), Buffer.from(await file.arrayBuffer()));
    db.insert(schema.photos)
      .values({ id, vehicleId: opts.vehicleId, eventId: opts.eventId ?? null, filename, mime: file.type, uploadedBy: opts.userId })
      .run();
    ids.push(id);
  }
  return ids;
}

/** Deletes photo rows and their files. */
export async function deletePhotos(ids: string[]) {
  if (!ids.length) return;
  const db = getDb();
  const rows = db.select().from(schema.photos).where(inArray(schema.photos.id, ids)).all();
  await Promise.all(rows.map((r) => fs.rm(path.join(/*turbopackIgnore: true*/ PHOTO_DIR, r.filename), { force: true })));
  db.delete(schema.photos).where(inArray(schema.photos.id, ids)).run();
}
