"use client";

import { useState } from "react";
import { fill, useI18n } from "@/lib/i18n/client";

const PRESETS = [1, 2, 3, 5, 10, 20];

export function PremixCalculator({ ratio: initialRatio, source }: { ratio: number | null; source: "sheet" | "stock" | null }) {
  const { t, lang } = useI18n();
  const [litres, setLitres] = useState("5");
  const [ratio, setRatio] = useState(String(initialRatio ?? 32));
  const l = Number(litres.replace(",", "."));
  const r = Number(ratio.replace(",", "."));
  const valid = l > 0 && l <= 100 && r >= 10 && r <= 100;
  const ml = valid ? Math.round((l * 1000) / r) : null;
  const perL = valid ? Math.round(1000 / r) : null;
  const fmt = (n: number) => n.toLocaleString(lang === "hu" ? "hu-HU" : "en-GB");

  return (
    <div className="card p-4">
      <h2 className="mb-3 font-semibold">⛽ {t.premix.title}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="premix_l">
            {t.premix.fuel}
          </label>
          <input id="premix_l" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="premix_r">
            {t.premix.ratio}
          </label>
          <div className="flex items-center gap-1">
            <input id="premix_r" inputMode="decimal" value={ratio} onChange={(e) => setRatio(e.target.value)} className="input" />
            <span className="shrink-0 whitespace-nowrap text-muted">: 1</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setLitres(String(p))}
            className={`chip ${String(p) === litres ? "bg-accent text-black" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {p} L
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-surface-2 p-3 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">{t.premix.oil}</p>
        <p className="text-3xl font-bold text-accent">{ml != null ? `${fmt(ml)} ml` : "—"}</p>
        {perL != null && <p className="text-xs text-muted">{fill(t.premix.perLitre, { ml: fmt(perL) })}</p>}
      </div>
      {source && initialRatio && (
        <p className="mt-2 text-[11px] text-muted">{fill(t.premix.from, { source: source === "sheet" ? t.premix.sourceSheet : t.premix.sourceStock })}</p>
      )}
    </div>
  );
}
