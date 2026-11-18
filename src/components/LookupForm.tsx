"use client";

import { useActionState, useEffect, useState } from "react";
import { lookupModel, type LookupFormState } from "@/app/catalogue/actions";
import { useI18n } from "@/lib/i18n/client";
import { SubmitButton } from "./SubmitButton";

const CATEGORIES = ["mx", "enduro", "trail", "supermoto", "street", "other"] as const;
const MARKETS = ["Europe", "USA", "Other"] as const;

export function LookupForm({ disabled }: { disabled: "noKey" | "limit" | null }) {
  const { t } = useI18n();
  const [state, action] = useActionState<LookupFormState, FormData>(lookupModel, { error: null });
  const error = state.error ?? disabled;
  const year = new Date().getFullYear();
  const [make, setMake] = useState("");
  const [modelYear, setModelYear] = useState("");
  const makes = useSuggestions(make.trim().length >= 1 ? `q=${encodeURIComponent(make.trim())}` : "q=");
  const models = useSuggestions(make.trim() ? `make=${encodeURIComponent(make.trim())}&year=${/^\d{4}$/.test(modelYear) ? modelYear : ""}` : null);

  return (
    <form action={action} id="lookup" className="card space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">{t.catalogue.lookupTitle}</h2>
        <p className="text-xs text-muted">{t.catalogue.lookupHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="make">
            {t.catalogue.make} *
          </label>
          <input
            id="make"
            name="make"
            required
            maxLength={40}
            placeholder="Yamaha"
            list="make-suggestions"
            autoComplete="off"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="input"
          />
          <datalist id="make-suggestions">
            {makes.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="model">
            {t.catalogue.model} *
          </label>
          <input id="model" name="model" required maxLength={60} placeholder="YZ125" list="model-suggestions" autoComplete="off" className="input" />
          <datalist id="model-suggestions">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="engine_cc">
            {t.catalogue.cc} *
          </label>
          <input id="engine_cc" name="engine_cc" type="number" required min={30} max={2500} inputMode="numeric" placeholder="125" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="year">
            {t.catalogue.year} *
          </label>
          <input
            id="year"
            name="year"
            type="number"
            required
            min={1950}
            max={year + 1}
            inputMode="numeric"
            placeholder="2001"
            value={modelYear}
            onChange={(e) => setModelYear(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="stroke">
            {t.catalogue.stroke}
          </label>
          <select id="stroke" name="stroke" className="input" defaultValue="">
            <option value="">{t.catalogue.strokeAny}</option>
            <option value="2">{t.catalogue.stroke2}</option>
            <option value="4">{t.catalogue.stroke4}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">
            {t.catalogue.category}
          </label>
          <select id="category" name="category" className="input" defaultValue="">
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.catalogue.categories[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="market">
            {t.catalogue.market}
          </label>
          <select id="market" name="market" className="input" defaultValue="Europe">
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {t.catalogue.markets[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <SubmitButton className="btn-primary w-full">{t.catalogue.submit}</SubmitButton>
        </div>
      </div>
      {error && <p className="rounded-xl bg-red-950/40 px-3 py-2 text-sm text-red-300">{t.catalogue[error]}</p>}
    </form>
  );
}

/** Fetches autocomplete names (debounced). `query` null = no suggestions. */
function useSuggestions(query: string | null) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    if (query == null) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/catalogue/names?${query}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((v: string[]) => setList(v))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  return query == null ? [] : list;
}
