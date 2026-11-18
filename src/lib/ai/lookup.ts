import "server-only";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { LookupInput } from "@/db/schema";
import { TUNING_FIELDS } from "@/lib/tuning";
import { ZONES } from "@/lib/zones";

/**
 * Catalogue lookup: one OpenAI Responses call with the web_search tool that returns
 * specs, service intervals, compatible parts and the stock setup for one model year.
 * Kept deliberately small: one call per model, capped searches and output tokens,
 * and a monthly limit (AI_MONTHLY_LOOKUPS).
 */

export const SPEC_GROUPS = ["engine", "fuel", "ignition", "drivetrain", "chassis", "suspension", "brakes", "wheels", "fluids", "dimensions"] as const;

/** Keys the YZ125 seed uses – asking for the same keys makes results comparable. */
const PREFERRED_SPEC_KEYS =
  "engine_type, displacement, bore_stroke, compression, piston, ring_gap, gearbox, fuel, premix, tank, carb, jetting_eu, jetting_us, plug, plug_gap, ignition, trans_oil, coolant, air_filter_oil, chain, gearing, chain_slack, tyre_f, tyre_r, tyre_pressure, fork, fork_oil, shock, brakes, brake_pads, brake_fluid, axle_torque, weight, dimensions";
const PREFERRED_TASK_KEYS =
  "air_filter, chain, spark_plug, piston_rings, top_end, transmission_oil, engine_oil, oil_filter, valve_clearance, silencer, fork_oil, shock_service, wheel_bearings, steering_head, brake_fluid, coolant";

export function aiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-6-luna",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    monthlyLimit: Number(process.env.AI_MONTHLY_LOOKUPS || 20),
    maxSearches: Number(process.env.AI_MAX_SEARCHES || 12),
  };
}

/** USD per million tokens (input, output). Unknown models are priced like the most expensive one. */
const PRICES: Record<string, [number, number]> = {
  "gpt-6-luna": [0.1, 0.5],
  "gpt-6.1-terra": [1, 5],
  "gpt-6.2-sol": [2, 10],
  "gpt-6.2-astra": [8, 40],
};
const SEARCH_CALL_USD = 0.01; // $10 per 1k web_search calls

export function lookupsThisMonth() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const since = start.toISOString().replace("T", " ").slice(0, 19); // CURRENT_TIMESTAMP format
  const row = getDb()
    .select({ n: sql<number>`count(*)`, cost: sql<number>`coalesce(sum(${s.aiLookups.costUsd}), 0)` })
    .from(s.aiLookups)
    .where(and(gte(s.aiLookups.createdAt, since), ne(s.aiLookups.status, "failed")))
    .get();
  return { count: row?.n ?? 0, costUsd: row?.cost ?? 0 };
}

// ---------------------------------------------------------------------------
// Output schema (strict structured output: every field required, nullable via type arrays)
// ---------------------------------------------------------------------------

const str = { type: "string" };
const strOrNull = { type: ["string", "null"] };
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });

const SCHEMA = obj({
  identified: obj({
    official_name: str,
    model_code: strOrNull,
    displacement_cc: { type: ["number", "null"] },
    stroke: { type: ["integer", "null"], enum: [2, 4, null] },
    category: { type: "string", enum: ["mx", "enduro", "trail", "supermoto", "street", "other"] },
    matches_request: { type: "boolean" },
    note: strOrNull,
  }),
  summary_en: str,
  summary_hu: str,
  parts_catalog_url: strOrNull,
  manual_url: strOrNull,
  specs: {
    type: "array",
    items: obj({
      key: str,
      group: { type: "string", enum: [...SPEC_GROUPS] },
      zone: { type: "string", enum: ZONES },
      label_en: str,
      label_hu: str,
      value: str,
      source_url: strOrNull,
    }),
  },
  intervals: {
    type: "array",
    items: obj({
      task_key: str,
      zone: { type: "string", enum: ZONES },
      label_en: str,
      label_hu: str,
      hours: { type: ["number", "null"] },
      months: { type: ["integer", "null"] },
      notes_en: str,
      notes_hu: str,
      source_url: strOrNull,
    }),
  },
  parts: {
    type: "array",
    items: obj({
      zone: { type: "string", enum: ZONES },
      category: str,
      brand: str,
      name: str,
      part_number: strOrNull,
      is_oem: { type: "boolean" },
      search_query: str,
      notes_en: strOrNull,
      notes_hu: strOrNull,
      source_url: strOrNull,
    }),
  },
  stock_setup: {
    type: "array",
    items: obj({ key: { type: "string", enum: TUNING_FIELDS.map((f) => f.key) }, value: str, source_url: strOrNull }),
  },
  warnings: { type: "array", items: str },
});

export type LookupResult = {
  identified: {
    official_name: string;
    model_code: string | null;
    displacement_cc: number | null;
    stroke: 2 | 4 | null;
    category: string;
    matches_request: boolean;
    note: string | null;
  };
  summary_en: string;
  summary_hu: string;
  parts_catalog_url: string | null;
  manual_url: string | null;
  specs: { key: string; group: string; zone: string; label_en: string; label_hu: string; value: string; source_url: string | null }[];
  intervals: {
    task_key: string;
    zone: string;
    label_en: string;
    label_hu: string;
    hours: number | null;
    months: number | null;
    notes_en: string;
    notes_hu: string;
    source_url: string | null;
  }[];
  parts: {
    zone: string;
    category: string;
    brand: string;
    name: string;
    part_number: string | null;
    is_oem: boolean;
    search_query: string;
    notes_en: string | null;
    notes_hu: string | null;
    source_url: string | null;
  }[];
  stock_setup: { key: string; value: string; source_url: string | null }[];
  warnings: string[];
};

function prompt(i: LookupInput) {
  const bike = `${i.year} ${i.make} ${i.model}, ${i.engineCc} cc${i.stroke ? `, ${i.stroke}-stroke` : ""}${i.category ? `, ${i.category}` : ""}`;
  const instructions = `You compile reference data for a motorcycle maintenance app. Use web search. Accuracy matters more than completeness.

Rules:
- Only state a value if a source you found gives it for THIS model year (or explicitly for a year range that includes it). Otherwise leave it out. Never guess.
- Prefer, in order: manufacturer owner's/service manuals (often hosted on manualslib.com), OEM parts fiches (cmsnl.com, partzilla.com, boats.net, yamaha/ktm/honda parts sites), the manufacturer's own pages, then reputable retailers' fitment lists. Avoid forums unless nothing else exists, and say so in warnings.
- Market: ${i.market}. If specs differ between markets (jetting, gearing, suspension), give the ${i.market} values in the main fields and mention others in the value text.
- Metric units. Keep values short (under 160 characters). label_hu in natural Hungarian.
- Put the page you used in source_url for every item. If the model year/name you were given looks wrong, set identified.matches_request=false and explain in identified.note.
- specs: use these keys where they apply: ${PREFERRED_SPEC_KEYS}. Other keys are fine for important extra data.
- intervals: the manufacturer's maintenance schedule. Use hours (convert per-race intervals at ~2 h per race and say so in notes) or months for time-based items. Keys where they apply: ${PREFERRED_TASK_KEYS}.
- parts: up to 15 commonly replaced parts (plug, chain, sprockets, air filter, brake pads, piston kit, oil filter, plastics, exhaust…). part_number only when a source lists it for this exact model year; otherwise null and a good search_query.
- stock_setup: factory settings (jets, needle, clip, air screw, clicker positions in clicks/turns out, spring rates, tyre pressures, sprockets). Plain values without units, e.g. "450", "12", "1.5".
- warnings: anything a rider should double-check.`;
  return { instructions, input: `Motorcycle: ${bike}.` };
}

type ResponsesOutputItem = {
  type: string;
  content?: { type: string; text?: string; refusal?: string; annotations?: { type: string; url?: string }[] }[];
  action?: { sources?: { url?: string }[] };
};

async function callOpenAI(input: LookupInput) {
  const cfg = aiConfig();
  if (!cfg.apiKey) throw new Error("OPENAI_API_KEY is not set on the server");
  const { instructions, input: userInput } = prompt(input);

  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    signal: AbortSignal.timeout(8 * 60 * 1000),
    body: JSON.stringify({
      model: cfg.model,
      instructions,
      input: userInput,
      tools: [{ type: "web_search", search_context_size: "medium", user_location: { type: "approximate", country: "HU" } }],
      max_tool_calls: cfg.maxSearches,
      include: ["web_search_call.action.sources"],
      max_output_tokens: 16000,
      text: { format: { type: "json_schema", name: "bike_reference", strict: true, schema: SCHEMA } },
      store: false,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message ?? res.statusText}`);

  const output: ResponsesOutputItem[] = body.output ?? [];
  const searchCalls = output.filter((o) => o.type === "web_search_call").length;
  const inputTokens: number = body.usage?.input_tokens ?? 0;
  const outputTokens: number = body.usage?.output_tokens ?? 0;
  const [pin, pout] = PRICES[cfg.model] ?? PRICES["gpt-6.2-astra"];
  const costUsd = (inputTokens * pin + outputTokens * pout) / 1e6 + searchCalls * SEARCH_CALL_USD;

  const sources = new Set<string>();
  for (const o of output) {
    for (const src of o.action?.sources ?? []) if (src.url) sources.add(src.url);
    for (const c of o.content ?? []) for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) sources.add(a.url);
  }

  const usage = { aiModel: cfg.model, inputTokens, outputTokens, searchCalls, costUsd, sources: [...sources] };
  if (body.status === "incomplete") throw Object.assign(new Error(`Incomplete response (${body.incomplete_details?.reason ?? "unknown"})`), { usage });
  const content = output.find((o) => o.type === "message")?.content ?? [];
  const refusal = content.find((c) => c.type === "refusal");
  if (refusal) throw Object.assign(new Error(`Refused: ${refusal.refusal}`), { usage });
  const text = content.find((c) => c.type === "output_text")?.text;
  if (!text) throw Object.assign(new Error("No output text"), { usage });
  let result: LookupResult;
  try {
    result = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Output was not valid JSON"), { usage });
  }
  return { result, usage };
}

// ---------------------------------------------------------------------------
// Running and applying
// ---------------------------------------------------------------------------

const RUNNING = new Set<string>();

/** Starts a lookup in the background (the request that created it returns immediately). */
export function startLookup(lookupId: string) {
  if (RUNNING.has(lookupId)) return;
  RUNNING.add(lookupId);
  void runLookup(lookupId)
    .catch((e) => console.error("[ai-lookup]", lookupId, e))
    .finally(() => RUNNING.delete(lookupId));
}

/** A lookup left "running" by a restart can never finish; mark it failed. */
export function expireStaleLookup(row: { id: string; status: string; createdAt: string }) {
  const age = Date.now() - new Date(row.createdAt.replace(" ", "T") + "Z").getTime();
  if ((row.status === "running" || row.status === "queued") && !RUNNING.has(row.id) && age > 60_000) {
    getDb()
      .update(s.aiLookups)
      .set({ status: "failed", error: "Interrupted (server restarted?)", finishedAt: new Date().toISOString() })
      .where(eq(s.aiLookups.id, row.id))
      .run();
    return true;
  }
  return false;
}

async function runLookup(lookupId: string) {
  const db = getDb();
  const row = db.select().from(s.aiLookups).where(eq(s.aiLookups.id, lookupId)).get();
  if (!row) return;
  db.update(s.aiLookups).set({ status: "running" }).where(eq(s.aiLookups.id, lookupId)).run();
  try {
    const { result, usage } = await callOpenAI(row.input);
    db.transaction((tx) => {
      tx.update(s.aiLookups)
        .set({ status: "done", result, ...usage, finishedAt: new Date().toISOString() })
        .where(eq(s.aiLookups.id, lookupId))
        .run();
      if (row.apply && row.modelId) applyResult(tx, row.modelId, result, row.input);
    });
  } catch (e) {
    const usage = (e as { usage?: object }).usage ?? {};
    db.update(s.aiLookups)
      .set({ status: "failed", error: e instanceof Error ? e.message : String(e), ...usage, finishedAt: new Date().toISOString() })
      .where(eq(s.aiLookups.id, lookupId))
      .run();
  }
}

const httpUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
const host = (u: string | null) => {
  try {
    return u ? new URL(u).hostname : null;
  } catch {
    return null;
  }
};
const aiSource = (u: string | null) => (httpUrl(u) ? `AI · ${u}` : "AI · no source");

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Writes an AI result into the catalogue as unverified data. Rows riders corrected are kept. */
function applyResult(tx: Tx, modelId: string, r: LookupResult, input: LookupInput) {
  const zone = (z: string) => (ZONES.includes(z as never) ? z : "other");
  tx.update(s.vehicleModels)
    .set({
      summaryEn: r.summary_en || null,
      summaryHu: r.summary_hu || null,
      partsCatalogUrl: httpUrl(r.parts_catalog_url),
      ownersManualUrl: httpUrl(r.manual_url),
      // Make, model, year and displacement come from the rider's form and are kept as entered.
      category: input.category ?? r.identified.category,
      stroke: input.stroke ?? r.identified.stroke ?? undefined,
      dataOrigin: "ai",
      stockSetup: r.stock_setup.length
        ? { source: "AI draft – unverified", values: Object.fromEntries(r.stock_setup.map((x) => [x.key, x.value.slice(0, 80)])) }
        : null,
    })
    .where(eq(s.vehicleModels.id, modelId))
    .run();

  // Replace earlier AI rows; keep anything a rider entered or corrected.
  tx.delete(s.modelSpecs).where(and(eq(s.modelSpecs.modelId, modelId), eq(s.modelSpecs.isSeed, true))).run();
  const seen = new Set<string>();
  for (const x of r.specs) {
    const key = x.key.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    if (!key || seen.has(key) || !x.value) continue;
    seen.add(key);
    const exists = tx.select({ id: s.modelSpecs.id }).from(s.modelSpecs).where(and(eq(s.modelSpecs.modelId, modelId), eq(s.modelSpecs.seedKey, key))).get();
    if (exists) continue; // a rider's own row with this key wins
    tx.insert(s.modelSpecs)
      .values({ modelId, seedKey: key, specGroup: x.group, zone: zone(x.zone), labelEn: x.label_en, labelHu: x.label_hu, value: x.value.slice(0, 300), source: aiSource(x.source_url), isSeed: true })
      .run();
  }

  tx.delete(s.serviceIntervals).where(eq(s.serviceIntervals.modelId, modelId)).run();
  const tasks = new Set<string>();
  for (const x of r.intervals) {
    const key = x.task_key.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
    if (!key || tasks.has(key) || (x.hours == null && x.months == null)) continue;
    tasks.add(key);
    const src = host(httpUrl(x.source_url));
    tx.insert(s.serviceIntervals)
      .values({
        modelId,
        taskKey: key,
        zone: zone(x.zone),
        labelEn: x.label_en,
        labelHu: x.label_hu,
        intervalHours: x.hours,
        intervalMonths: x.months,
        notesEn: [x.notes_en, src && `AI · ${src}`].filter(Boolean).join(" · ") || null,
        notesHu: [x.notes_hu, src && `AI · ${src}`].filter(Boolean).join(" · ") || null,
      })
      .run();
  }

  tx.delete(s.fitmentParts).where(and(eq(s.fitmentParts.modelId, modelId), eq(s.fitmentParts.isSeed, true))).run();
  r.parts.slice(0, 20).forEach((x, i) => {
    tx.insert(s.fitmentParts)
      .values({
        modelId,
        seedKey: `ai_${i}`,
        zone: zone(x.zone),
        category: x.category,
        brand: x.brand,
        name: x.name,
        partNumber: x.part_number,
        isOem: x.is_oem,
        searchQuery: x.search_query || `${x.brand} ${x.name}`,
        infoUrl: httpUrl(x.source_url),
        notesEn: x.notes_en,
        notesHu: x.notes_hu,
        isSeed: true,
      })
      .run();
  });
}
