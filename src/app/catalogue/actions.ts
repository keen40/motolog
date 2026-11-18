"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema as s } from "@/db";
import type { LookupInput } from "@/db/schema";
import { aiConfig, lookupsThisMonth, startLookup } from "@/lib/ai/lookup";
import { requireUser } from "@/lib/auth";

export type LookupFormState = { error: "noKey" | "limit" | "invalid" | null };

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
};

export async function lookupModel(_prev: LookupFormState, formData: FormData): Promise<LookupFormState> {
  const user = await requireUser();
  const cfg = aiConfig();
  if (!cfg.apiKey) return { error: "noKey" };
  if (lookupsThisMonth().count >= cfg.monthlyLimit) return { error: "limit" };

  const make = text(formData, "make");
  const model = text(formData, "model");
  const year = Number(text(formData, "year"));
  const engineCc = Number(text(formData, "engine_cc"));
  const stroke = Number(text(formData, "stroke")) || null;
  const thisYear = new Date().getFullYear();
  if (!make || !model || make.length > 40 || model.length > 60) return { error: "invalid" };
  if (!Number.isInteger(year) || year < 1950 || year > thisYear + 1) return { error: "invalid" };
  if (!Number.isFinite(engineCc) || engineCc < 30 || engineCc > 2500) return { error: "invalid" };

  const input: LookupInput = {
    make,
    model,
    year,
    engineCc: Math.round(engineCc),
    stroke: stroke === 2 || stroke === 4 ? stroke : null,
    category: text(formData, "category") || null,
    market: text(formData, "market") || "Europe",
  };

  const db = getDb();
  // Same make + model + year already in the catalogue? Compare instead of overwriting checked data.
  let existing = db
    .select()
    .from(s.vehicleModels)
    .where(and(sql`lower(${s.vehicleModels.make}) = lower(${make})`, sql`lower(${s.vehicleModels.model}) = lower(${model})`, sql`${year} between ${s.vehicleModels.yearFrom} and ${s.vehicleModels.yearTo}`))
    .get();
  const hasSpecs = existing ? !!db.select({ id: s.modelSpecs.id }).from(s.modelSpecs).where(eq(s.modelSpecs.modelId, existing.id)).get() : false;
  const apply = !existing || !hasSpecs || existing.dataOrigin === "ai";

  if (!existing) {
    existing = db
      .insert(s.vehicleModels)
      .values({
        vehicleType: "motorcycle",
        category: input.category ?? "other",
        make,
        model,
        yearFrom: year,
        yearTo: year,
        engineCc: input.engineCc,
        stroke: input.stroke,
        dataOrigin: "ai",
      })
      .returning()
      .get();
  }

  const lookup = db.insert(s.aiLookups).values({ modelId: existing.id, userId: user.id, input, apply, aiModel: cfg.model }).returning({ id: s.aiLookups.id }).get();
  startLookup(lookup.id);
  redirect(`/catalogue/lookups/${lookup.id}`);
}

/** Re-runs a failed lookup with the same input. */
export async function retryLookup(lookupId: string) {
  const user = await requireUser();
  const cfg = aiConfig();
  const db = getDb();
  const old = db.select().from(s.aiLookups).where(eq(s.aiLookups.id, lookupId)).get();
  if (!old || !cfg.apiKey || lookupsThisMonth().count >= cfg.monthlyLimit) redirect(`/catalogue/lookups/${lookupId}`);
  const lookup = db
    .insert(s.aiLookups)
    .values({ modelId: old.modelId, userId: user.id, input: old.input, apply: old.apply, aiModel: cfg.model })
    .returning({ id: s.aiLookups.id })
    .get();
  startLookup(lookup.id);
  redirect(`/catalogue/lookups/${lookup.id}`);
}
