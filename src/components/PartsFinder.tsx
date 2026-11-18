"use client";

import { useState } from "react";
import { addFitmentPart } from "@/app/garage/actions";
import { useI18n } from "@/lib/i18n/client";
import { shopQuery, type QueryPart } from "@/lib/shopQuery";
import type { FitmentPart, Shop, ZoneId } from "@/lib/types";
import { ZONES } from "@/lib/zones";
import { SubmitButton } from "./SubmitButton";

type Props = {
  vehicleId: string;
  modelId: string;
  bikeName: string;
  parts: FitmentPart[];
  shops: Shop[];
  initialZone: ZoneId | null;
};

const FLAGS: Record<string, string> = { HU: "🇭🇺", CZ: "🇨🇿", DE: "🇩🇪", SK: "🇸🇰", AT: "🇦🇹", EU: "🇪🇺" };

export function shopUrl(shop: Shop, query: string) {
  return shop.searchUrlTemplate.replace("{q}", encodeURIComponent(query));
}

export function PartsFinder({ vehicleId, modelId, bikeName, parts, shops, initialZone }: Props) {
  const { t, lang } = useI18n();
  const [zone, setZone] = useState<ZoneId | "all">(initialZone ?? "all");
  const [free, setFree] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const zonesWithParts = ZONES.filter((z) => parts.some((p) => p.zone === z));
  const list = zone === "all" ? parts : parts.filter((p) => p.zone === zone);
  const model = bikeName.split(" ").pop()!;
  const freeQuery = free.trim() ? `${bikeName} ${free.trim()}` : "";

  return (
    <div className="space-y-4">
      {/* Free search */}
      <div className="card p-4">
        <h2 className="mb-2 font-semibold">{t.parts.searchAll}</h2>
        <input value={free} onChange={(e) => setFree(e.target.value)} placeholder={t.parts.searchPh} className="input" />
        {freeQuery && <ShopLinks shops={shops} free={freeQuery} model={model} />}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t.parts.title}</h2>
          <select value={zone} onChange={(e) => setZone(e.target.value as ZoneId | "all")} className="input w-auto py-1 text-xs" aria-label={t.parts.filter}>
            <option value="all">{t.diagram.allZones}</option>
            {zonesWithParts.map((z) => (
              <option key={z} value={z}>
                {t.zones[z]}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 rounded-xl bg-amber-950/30 px-3 py-2 text-xs text-amber-200/80">⚠ {t.parts.note}</p>

        {list.length === 0 && <p className="text-sm text-muted">{t.diagram.nothing}</p>}
        <ul className="space-y-2">
          {list.map((p) => {
            const isOpen = open === p.id;
            return (
              <li key={p.id} className="rounded-xl bg-surface-2">
                <button onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                  <span className={`chip ${p.isOem ? "bg-sky-900/50 text-sky-300" : "bg-amber-900/40 text-amber-300"}`}>
                    {p.isOem ? t.parts.oem : t.parts.aftermarket}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.brand} – {p.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {p.category} · {t.zones[p.zone]}
                      {p.partNumber && <span className="font-mono"> · #{p.partNumber}</span>}
                    </span>
                  </span>
                  <span className="text-muted">{isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border px-3 py-3">
                    {(lang === "hu" ? p.notesHu : p.notesEn) && <p className="mb-2 text-xs text-muted">{lang === "hu" ? p.notesHu : p.notesEn}</p>}
                    {p.infoUrl && (
                      <a href={p.infoUrl} target="_blank" rel="noopener noreferrer" className="mb-2 inline-block text-xs text-accent hover:underline">
                        {t.parts.brandSite} ↗
                      </a>
                    )}
                    <ShopLinks shops={shops} part={p} model={model} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-accent">+ {t.parts.addPart}</summary>
          <form action={addFitmentPart.bind(null, vehicleId, modelId)} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select name="zone" className="input" aria-label={t.event.zone} defaultValue={zone === "all" ? "other" : zone}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {t.zones[z]}
                </option>
              ))}
            </select>
            <input name="category" placeholder={t.parts.category} className="input" />
            <input name="brand" required placeholder={t.parts.brand} className="input" />
            <input name="name" required placeholder={t.parts.name} className="input" />
            <input name="part_number" placeholder={t.event.partNumber} className="input" />
            <input name="info_url" type="url" placeholder="https://…" className="input" />
            <div className="sm:col-span-2">
              <SubmitButton className="btn-ghost w-full">{t.specs.save}</SubmitButton>
            </div>
          </form>
        </details>
      </div>
    </div>
  );
}

/** One link per shop; each searches in the shop's own language (see lib/shopQuery). */
function ShopLinks({ shops, part, free, model }: { shops: Shop[]; part?: QueryPart; free?: string; model: string }) {
  const { t, lang } = useI18n();
  const queryFor = (shopLang: string) => (part ? shopQuery(part, model, shopLang) : free!);
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        {t.parts.whereToBuy}: <span className="normal-case text-foreground">“{queryFor(lang)}”</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {shops
          .filter((s) => s.shipsTo.includes("HU"))
          .map((s) => {
            const q = queryFor(s.language);
            return (
              <a
                key={s.id}
                href={shopUrl(s, q)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:border-accent"
                title={`${s.country === "HU" ? s.name : `${s.name} – ${t.parts.shipsHu}`} · “${q}”`}
              >
                <span>{FLAGS[s.country] ?? "🌐"}</span>
                {s.name}
                <span className="uppercase text-muted">{s.language}</span>
                <span className="text-muted">↗</span>
              </a>
            );
          })}
      </div>
    </div>
  );
}
