import type { TuningSheet } from "./types";

export type TuningGroup = "carb" | "engine" | "fork" | "shock" | "chassis";

export type TuningField = {
  key: string;
  group: TuningGroup;
  en: string;
  hu: string;
  /** Numeric fields get a decimal keyboard on phones. Values are still stored as text ("1 1/2" is fine). */
  numeric?: boolean;
  unit?: string;
};

export const TUNING_GROUPS: TuningGroup[] = ["carb", "engine", "fork", "shock", "chassis"];

export const TUNING_FIELDS: TuningField[] = [
  { key: "main_jet", group: "carb", en: "Main jet", hu: "Főfúvóka", numeric: true },
  { key: "pilot_jet", group: "carb", en: "Pilot jet", hu: "Alapjárati fúvóka", numeric: true },
  { key: "needle", group: "carb", en: "Needle", hu: "Tű" },
  { key: "clip", group: "carb", en: "Needle clip", hu: "Tűállás (klipsz)", numeric: true },
  { key: "air_screw", group: "carb", en: "Air screw", hu: "Levegőcsavar", numeric: true, unit: "turns" },
  { key: "slide", group: "carb", en: "Slide cutaway", hu: "Tolattyú-kivágás" },

  { key: "premix", group: "engine", en: "Premix ratio", hu: "Keverési arány" },
  { key: "oil", group: "engine", en: "2T oil", hu: "2T olaj" },
  { key: "fuel", group: "engine", en: "Fuel", hu: "Üzemanyag" },
  { key: "plug", group: "engine", en: "Spark plug", hu: "Gyertya" },

  { key: "fork_comp", group: "fork", en: "Compression", hu: "Kompresszió", numeric: true, unit: "clicks" },
  { key: "fork_reb", group: "fork", en: "Rebound", hu: "Visszarugózás", numeric: true, unit: "clicks" },
  { key: "fork_height", group: "fork", en: "Tube height in clamps", hu: "Villacső kilógás", numeric: true, unit: "mm" },
  { key: "fork_oil_level", group: "fork", en: "Oil level", hu: "Olajszint", numeric: true, unit: "mm" },
  { key: "fork_spring", group: "fork", en: "Spring rate", hu: "Rugókeménység", numeric: true, unit: "N/mm" },

  { key: "shock_lsc", group: "shock", en: "Low-speed compression", hu: "Lassú kompresszió", numeric: true, unit: "clicks" },
  { key: "shock_hsc", group: "shock", en: "High-speed compression", hu: "Gyors kompresszió", numeric: true, unit: "turns" },
  { key: "shock_reb", group: "shock", en: "Rebound", hu: "Visszarugózás", numeric: true, unit: "clicks" },
  { key: "race_sag", group: "shock", en: "Race sag", hu: "Menet-sag (rider sag)", numeric: true, unit: "mm" },
  { key: "static_sag", group: "shock", en: "Static sag", hu: "Statikus sag", numeric: true, unit: "mm" },
  { key: "shock_preload", group: "shock", en: "Spring length (installed)", hu: "Rugóhossz (beépítve)", numeric: true, unit: "mm" },
  { key: "shock_spring", group: "shock", en: "Spring rate", hu: "Rugókeménység", numeric: true, unit: "N/mm" },

  { key: "tyre_f", group: "chassis", en: "Front tyre pressure", hu: "Első guminyomás", numeric: true, unit: "bar" },
  { key: "tyre_r", group: "chassis", en: "Rear tyre pressure", hu: "Hátsó guminyomás", numeric: true, unit: "bar" },
  { key: "tyres", group: "chassis", en: "Tyres", hu: "Gumik" },
  { key: "sprocket_f", group: "chassis", en: "Front sprocket", hu: "Első lánckerék", numeric: true, unit: "T" },
  { key: "sprocket_r", group: "chassis", en: "Rear sprocket", hu: "Hátsó lánckerék", numeric: true, unit: "T" },
];

export const SURFACES = ["hardpack", "loam", "sand", "mud", "rocky", "mixed"] as const;

export const UNITS_HU: Record<string, string> = { turns: "fordulat", clicks: "katt" };

export function unitLabel(unit: string | undefined, lang: string) {
  if (!unit) return "";
  return lang === "hu" ? (UNITS_HU[unit] ?? unit) : unit;
}

/** Compare as the rider means it: "1.0" == "1", "1,5" == "1.5", case/whitespace ignored. */
export function normalize(v: string | undefined | null) {
  if (v == null) return "";
  const s = v.trim().toLowerCase().replace(",", ".").replace(/\s+/g, " ");
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? String(n) : s;
}

export function sameValue(a: string | undefined | null, b: string | undefined | null) {
  return normalize(a) === normalize(b);
}

export type Change = { field: TuningField; from: string; to: string };

/** Settings that differ between two sheets (only keys set on at least one side). */
export function diffSettings(from: Record<string, string>, to: Record<string, string>): Change[] {
  return TUNING_FIELDS.filter((f) => (from[f.key] || to[f.key]) && !sameValue(from[f.key], to[f.key])).map((field) => ({
    field,
    from: from[field.key] ?? "",
    to: to[field.key] ?? "",
  }));
}

/** Sheets newest first → each sheet paired with the changes since the sheet before it. */
export function withChanges(sheets: TuningSheet[]) {
  return sheets.map((sheet, i) => ({ sheet, changes: i + 1 < sheets.length ? diffSettings(sheets[i + 1].settings, sheet.settings) : null }));
}
