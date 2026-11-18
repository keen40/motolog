import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb, PHOTO_DIR, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Profile pictures: visible to anyone signed in (they appear next to shared bikes and entries).
export async function GET(_req: Request, ctx: RouteContext<"/avatars/[userId]">) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const { userId } = await ctx.params;
  const user = getDb().select({ file: schema.users.avatarFile }).from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!user?.file) return new Response("Not found", { status: 404 });
  const file = path.basename(user.file);
  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ PHOTO_DIR, "avatars", file));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": MIME[file.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
