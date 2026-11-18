import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb, schema as s } from "@/db";
import { runLookup, type LookupResult } from "@/lib/ai/lookup";

const db = () => getDb();

beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-6-luna";
  process.env.OPENAI_BASE_URL = "http://openai.test/v1";
});
afterEach(() => vi.unstubAllGlobals());

const base = (): LookupResult => ({
  identified: { official_name: "Test", model_code: null, displacement_cc: 250, stroke: 2, category: "mx", matches_request: true, note: null },
  summary_en: "Summary",
  summary_hu: "Összefoglaló",
  parts_catalog_url: "https://www.cmsnl.com/x",
  manual_url: null,
  hours_per_race: null,
  specs: [],
  intervals: [],
  parts: [],
  stock_setup: [],
  warnings: [],
});

const spec = (key: string, value: string, source_url: string | null = "https://global.honda/spec") => ({
  key,
  group: "engine",
  zone: "engine",
  label_en: key,
  label_hu: key,
  value,
  source_url,
});

/** Stubs fetch with one OpenAI Responses reply carrying `result`. */
function mockOpenAI(result: LookupResult | { status: number; message: string }, usage = { input_tokens: 1_000_000, output_tokens: 0 }, searches = 3) {
  const fetchMock = vi.fn(async () => {
    if ("status" in result) return new Response(JSON.stringify({ error: { message: result.message } }), { status: result.status });
    return Response.json({
      status: "completed",
      output: [
        ...Array.from({ length: searches }, () => ({ type: "web_search_call", action: { sources: [{ url: "https://global.honda/spec" }] } })),
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(result), annotations: [] }] },
      ],
      usage,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function newModel(model: string) {
  const m = db().insert(s.vehicleModels).values({ make: "Honda", model, yearFrom: 1999, yearTo: 1999, dataOrigin: "ai" }).returning().get();
  return m.id;
}
async function lookup(modelId: string, apply = true) {
  const l = db()
    .insert(s.aiLookups)
    .values({ modelId, input: { make: "Honda", model: "X", year: 1999, engineCc: 249, stroke: 2, category: "mx", market: "Europe" }, apply })
    .returning()
    .get();
  await runLookup(l.id);
  return db().select().from(s.aiLookups).where(eq(s.aiLookups.id, l.id)).get()!;
}
const specs = (modelId: string) =>
  Object.fromEntries(
    db()
      .select()
      .from(s.modelSpecs)
      .where(eq(s.modelSpecs.modelId, modelId))
      .all()
      .map((x) => [x.seedKey, x]),
  );

describe("AI lookup", () => {
  it("sends the documented request and records tokens, searches and cost", async () => {
    const id = newModel("REQ");
    const fetchMock = mockOpenAI({ ...base(), specs: [spec("bore_stroke", "66.4 × 72.0 mm")] });
    const row = await lookup(id);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(url).toBe("http://openai.test/v1/responses");
    expect(body.model).toBe("gpt-6-luna");
    expect(body.tools[0].type).toBe("web_search");
    expect(body.tools[0].filters.blocked_domains).toContain("emanualonline.com");
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(row.status).toBe("done");
    expect(row.searchCalls).toBe(3);
    expect(row.costUsd).toBeCloseTo(0.1 + 0.03, 5); // 1M input tokens on luna + 3 searches
  });

  it("drops values sourced from manual shops", async () => {
    const id = newModel("SHOP");
    mockOpenAI({
      ...base(),
      specs: [spec("coolant", "1.26 L", "https://www.emanualonline.com/cr250r"), spec("bore_stroke", "66.4 × 72.0 mm")],
      parts: [{ zone: "intake", category: "Air filter", brand: "Honda", name: "Element", part_number: "1", is_oem: true, search_query: "", notes_en: null, notes_hu: null, source_url: "https://haynes.com/x" }],
    });
    await lookup(id);
    const got = specs(id);
    expect(got.coolant).toBeUndefined();
    expect(got.bore_stroke.value).toBe("66.4 × 72.0 mm");
    expect(got.bore_stroke.source).toContain("global.honda");
    expect(db().select().from(s.fitmentParts).where(eq(s.fitmentParts.modelId, id)).all()).toHaveLength(0);
  });

  it("merges a re-run: updates, adds, keeps what it didn't return, never touches rider corrections", async () => {
    const id = newModel("MERGE");
    mockOpenAI({
      ...base(),
      specs: [spec("bore_stroke", "66.4 × 72.0 mm"), spec("plug", "NGK BR8EG"), spec("tank", "7.5 L")],
      stock_setup: [{ key: "main_jet", value: "190", source_url: null }],
    });
    await lookup(id);

    // A rider corrects the plug.
    const plug = specs(id).plug;
    db().update(s.modelSpecs).set({ value: "NGK BR9EG (mine)", isSeed: false }).where(eq(s.modelSpecs.id, plug.id)).run();

    // A sparse second run: changes the bore text, adds power, says nothing about the tank.
    mockOpenAI({
      ...base(),
      specs: [spec("bore_stroke", "66.4 x 72 mm"), spec("plug", "NGK B8EG"), spec("max_power", "58.2 PS")],
      stock_setup: [{ key: "pilot_jet", value: "42", source_url: null }],
    });
    await lookup(id);

    const got = specs(id);
    expect(got.bore_stroke.value).toBe("66.4 x 72 mm"); // updated
    expect(got.max_power.value).toBe("58.2 PS"); // added
    expect(got.tank.value).toBe("7.5 L"); // kept although not returned
    expect(got.plug.value).toBe("NGK BR9EG (mine)"); // rider's correction wins
    const model = db().select().from(s.vehicleModels).where(eq(s.vehicleModels.id, id)).get()!;
    expect(model.stockSetup?.values).toEqual({ main_jet: "190", pilot_jet: "42" });
    expect(model.engineCc).toBeNull(); // the form's values are kept; the AI doesn't overwrite them
  });

  it("converts per-race intervals with the manual's hours per race", async () => {
    const id = newModel("RACES");
    mockOpenAI({
      ...base(),
      hours_per_race: 2.5,
      intervals: [
        { task_key: "top_end", zone: "engine", label_en: "Piston", label_hu: "Dugattyú", every_races: 1, hours: null, months: null, notes_en: "inspect", notes_hu: "", source_url: null },
        { task_key: "top_end", zone: "engine", label_en: "Piston", label_hu: "Dugattyú", every_races: 5, hours: null, months: null, notes_en: "replace", notes_hu: "", source_url: null },
        { task_key: "coolant", zone: "engine", label_en: "Coolant", label_hu: "Hűtő", every_races: null, hours: null, months: 24, notes_en: "", notes_hu: "", source_url: null },
      ],
    });
    await lookup(id);
    const rows = db().select().from(s.serviceIntervals).where(eq(s.serviceIntervals.modelId, id)).all();
    const top = rows.find((r) => r.taskKey === "top_end")!;
    expect(rows).toHaveLength(2);
    expect(top.intervalHours).toBe(12.5);
    expect(top.notesEn).toContain("5 races × 2.5 h");
    expect(rows.find((r) => r.taskKey === "coolant")?.intervalMonths).toBe(24);
  });

  it("marks a failed call as failed and leaves the catalogue alone", async () => {
    const id = newModel("FAIL");
    mockOpenAI({ ...base(), specs: [spec("tank", "7.5 L")] });
    await lookup(id);
    mockOpenAI({ status: 400, message: "bad request" });
    const row = await lookup(id);
    expect(row.status).toBe("failed");
    expect(row.error).toContain("bad request");
    expect(specs(id).tank.value).toBe("7.5 L");
  });

  it("only compares, never writes, when the model has checked data", async () => {
    const yz = db().select().from(s.vehicleModels).where(and(eq(s.vehicleModels.make, "Yamaha"), eq(s.vehicleModels.model, "YZ125"))).get()!;
    const before = specs(yz.id);
    mockOpenAI({ ...base(), specs: [spec("plug_gap", "0.7–0.8 mm"), spec("brand_new", "x")] });
    const row = await lookup(yz.id, false);
    expect(row.status).toBe("done");
    const after = specs(yz.id);
    expect(after.plug_gap.value).toBe(before.plug_gap.value);
    expect(after.brand_new).toBeUndefined();
    expect(db().select().from(s.vehicleModels).where(eq(s.vehicleModels.id, yz.id)).get()?.dataOrigin).toBe("seed");
  });
});
