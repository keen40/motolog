import { sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { POPULAR_MAKES, vpicMakes, vpicModels } from "@/lib/vpic";

const norm = (v: string) => v.toLowerCase().replace(/[\s-]/g, "");

/**
 * Autocomplete for the lookup form.
 *   ?q=yam                → makes
 *   ?make=Yamaha&year=2001 → models (catalogue first, then NHTSA vPIC)
 */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json([], { status: 401 });
  const url = new URL(req.url);
  const make = url.searchParams.get("make")?.trim() ?? "";
  const year = Number(url.searchParams.get("year"));
  const db = getDb();

  if (make) {
    const own = db
      .select({ model: s.vehicleModels.model })
      .from(s.vehicleModels)
      .where(sql`lower(${s.vehicleModels.make}) = lower(${make})`)
      .all()
      .map((r) => r.model);
    const fromVpic = Number.isInteger(year) && year >= 1950 ? await vpicModels(make, year) : [];
    const seen = new Set<string>();
    const list = [...own, ...fromVpic.sort()].filter((m) => !seen.has(norm(m)) && seen.add(norm(m)));
    return Response.json(list.slice(0, 80), { headers: { "Cache-Control": "private, max-age=3600" } });
  }

  const q = norm(url.searchParams.get("q") ?? "");
  const own = db.selectDistinct({ make: s.vehicleModels.make }).from(s.vehicleModels).all().map((r) => r.make);
  // Our own and popular makes may match anywhere in the name; the long vPIC list only from the start.
  const known = [...own, ...POPULAR_MAKES].filter((m) => !q || norm(m).startsWith(q) || (q.length >= 2 && norm(m).includes(q)));
  const others = q.length >= 2 ? (await vpicMakes()).filter((m) => norm(m).startsWith(q)) : [];
  const seen = new Set<string>();
  const list = [...known, ...others].filter((m) => !seen.has(norm(m)) && seen.add(norm(m)));
  return Response.json(list.slice(0, 20), { headers: { "Cache-Control": "private, max-age=3600" } });
}
