import type { ZoneId } from "./types";

export const ZONES: ZoneId[] = [
  "engine",
  "intake",
  "exhaust",
  "fuel",
  "drivetrain",
  "suspension_front",
  "suspension_rear",
  "brakes",
  "wheels",
  "plastics",
  "controls",
  "electrical",
  "frame",
  "other",
];

export const KIND_COLORS = {
  service: "#38bdf8", // sky
  repair: "#f87171", // red
  mod: "#f59e0b", // amber
  plan: "#a78bfa", // violet
} as const;

export const CURRENCIES = ["HUF", "EUR", "CZK", "USD"] as const;

export function formatMoney(amount: number, currency: string, lang: string) {
  return new Intl.NumberFormat(lang === "hu" ? "hu-HU" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "HUF" || currency === "CZK" ? 0 : 2,
  }).format(amount);
}

export function formatDate(date: string | null, lang: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : "en-GB", { dateStyle: "medium" }).format(
    new Date(date),
  );
}
