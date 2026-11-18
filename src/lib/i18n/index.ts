import { cookies, headers } from "next/headers";
import en, { type Dict } from "./en";
import hu from "./hu";

export type Lang = "hu" | "en";
export const LANGS: Lang[] = ["hu", "en"];
const dicts: Record<Lang, Dict> = { en, hu };

export async function getLang(): Promise<Lang> {
  const cookieLang = (await cookies()).get("lang")?.value;
  if (cookieLang === "hu" || cookieLang === "en") return cookieLang;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("hu") ? "hu" : "en";
}

export async function getI18n() {
  const lang = await getLang();
  return { lang, t: dicts[lang] };
}

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export type { Dict };
