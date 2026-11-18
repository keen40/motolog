import "server-only";

/**
 * Make / model name suggestions from NHTSA's free vPIC database (US market, no key).
 * Only used for autocomplete – riders can always type any name. Responses are cached
 * in memory for a week; failures just mean no suggestions.
 */

const BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";
const TTL = 7 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: string[] }>();

/** Shown first, since vPIC's 1,700 "motorcycle" makes are mostly tiny custom builders. */
export const POPULAR_MAKES = [
  "Yamaha",
  "Honda",
  "Kawasaki",
  "Suzuki",
  "KTM",
  "Husqvarna",
  "GasGas",
  "Beta",
  "Sherco",
  "TM Racing",
  "Fantic",
  "Rieju",
  "Aprilia",
  "Ducati",
  "BMW",
  "Triumph",
  "Harley-Davidson",
  "Simson",
  "MZ",
  "Jawa",
  "CZ",
];

async function cached(key: string, url: string, pick: (r: Record<string, string>) => string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MotoLog" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { Results?: Record<string, string>[] };
    const value = [...new Set((body.Results ?? []).map(pick).map((v) => v?.trim()).filter(Boolean))];
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? [];
  }
}

const titleCase = (s: string) => (s.length <= 3 ? s.toUpperCase() : s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()));

export async function vpicMakes() {
  const all = await cached("makes", `${BASE}/GetMakesForVehicleType/motorcycle?format=json`, (r) => r.MakeName);
  return all.map(titleCase);
}

export async function vpicModels(make: string, year: number) {
  const url = `${BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}/vehicletype/motorcycle?format=json`;
  return cached(`models:${make.toLowerCase()}:${year}`, url, (r) => r.Model_Name);
}
