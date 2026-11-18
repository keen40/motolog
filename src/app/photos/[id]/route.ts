import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, PHOTO_DIR, schema } from "@/db";
import { vehicleRole } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";

// Serves a stored photo only to people who can see its vehicle.
export async function GET(_req: Request, ctx: RouteContext<"/photos/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const photo = getDb().select().from(schema.photos).where(eq(schema.photos.id, id)).get();
  if (!photo || !vehicleRole(user, photo.vehicleId)) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ PHOTO_DIR, path.basename(photo.filename)));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
