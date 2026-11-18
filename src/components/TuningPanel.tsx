import Link from "next/link";
import { fill, getI18n } from "@/lib/i18n";
import { diffSettings, sameValue, TUNING_FIELDS, TUNING_GROUPS, unitLabel, withChanges, type Change } from "@/lib/tuning";
import type { StockSetup, TuningSheet } from "@/lib/types";
import { formatDate } from "@/lib/zones";

type Props = {
  vehicleId: string;
  sheets: TuningSheet[];
  stock: StockSetup | null;
  editable: boolean;
  compare: { a: string; b: string } | null;
};

export function Stars({ n, className = "" }: { n: number | null; className?: string }) {
  if (!n) return null;
  return (
    <span className={`text-accent ${className}`} aria-label={`${n}/5`}>
      {"★".repeat(n)}
      <span className="text-border">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export async function TuningPanel({ vehicleId, sheets, stock, editable, compare }: Props) {
  const { t, lang } = await getI18n();
  const label = (key: string) => {
    // Outside the grouped view, "Rebound" alone could be fork or shock.
    const f = TUNING_FIELDS.find((x) => x.key === key)!;
    const name = lang === "hu" ? f.hu : f.en;
    return f.group === "fork" || f.group === "shock" ? `${t.tuning.short[f.group]} ${name.toLowerCase()}` : name;
  };
  const withUnit = (key: string, v: string) => {
    const f = TUNING_FIELDS.find((x) => x.key === key);
    const u = unitLabel(f?.unit, lang);
    return v && u ? `${v} ${u}` : v;
  };

  if (!sheets.length) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <h2 className="text-lg font-semibold">{t.tuning.title}</h2>
        <p className="mx-auto max-w-md text-sm text-muted">{t.tuning.intro}</p>
        {editable && (
          <div className="flex flex-wrap justify-center gap-2">
            {stock && (
              <Link href={`/garage/${vehicleId}/tuning/new?from=stock`} className="btn-primary">
                {t.tuning.fromStock}
              </Link>
            )}
            <Link href={`/garage/${vehicleId}/tuning/new?from=blank`} className={stock ? "btn-ghost" : "btn-primary"}>
              {t.tuning.fromBlank}
            </Link>
          </div>
        )}
        {stock && <p className="text-xs text-muted">{fill(t.tuning.stockSource, { source: stock.source })}</p>}
      </div>
    );
  }

  const latest = sheets[0];
  const history = withChanges(sheets);
  const a = compare && sheets.find((s) => s.id === compare.a);
  const b = compare && sheets.find((s) => s.id === compare.b);
  const sheetName = (s: TuningSheet) => `${s.sheetDate ? `${formatDate(s.sheetDate, lang)} · ` : ""}${s.title}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">{t.tuning.intro}</p>
        {editable && (
          <Link href={`/garage/${vehicleId}/tuning/new`} className="btn-primary">
            + {t.tuning.newSheet}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        {/* Current setup */}
        <div className="card h-fit p-4 lg:col-span-2">
          <h2 className="font-semibold">{t.tuning.current}</h2>
          <p className="mb-3 text-xs text-muted">{stock ? t.tuning.currentHint : sheetName(latest)}</p>
          <div className="space-y-3">
            {TUNING_GROUPS.map((g) => {
              const fields = TUNING_FIELDS.filter((f) => f.group === g && latest.settings[f.key]);
              if (!fields.length) return null;
              return (
                <div key={g}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t.tuning.groups[g]}</h3>
                  <dl className="divide-y divide-border rounded-xl bg-surface-2">
                    {fields.map((f) => {
                      const v = latest.settings[f.key];
                      const s = stock?.values[f.key];
                      const changed = s != null && !sameValue(s, v);
                      return (
                        <div key={f.key} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                          <dt className="text-muted">{lang === "hu" ? f.hu : f.en}</dt>
                          <dd className="text-right">
                            <span className={changed ? "font-semibold text-accent" : ""}>{withUnit(f.key, v)}</span>
                            {changed && (
                              <span className="block text-[11px] text-muted">
                                {t.tuning.stock}: {s}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>
          {stock && <p className="mt-3 text-[11px] text-muted">{fill(t.tuning.stockSource, { source: stock.source })}</p>}
        </div>

        <div className="space-y-4 lg:col-span-3">
          {/* Compare two sheets */}
          {sheets.length > 1 && (
            <form className="card flex flex-wrap items-end gap-2 p-4" action={`/garage/${vehicleId}`}>
              <input type="hidden" name="tab" value="tuning" />
              <h2 className="w-full font-semibold">{t.tuning.compare}</h2>
              {(["a", "b"] as const).map((k, i) => (
                <select key={k} name={k} defaultValue={compare?.[k] ?? sheets[i === 0 ? 1 : 0].id} className="input min-w-0 flex-1 basis-40">
                  {sheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sheetName(s)}
                    </option>
                  ))}
                </select>
              ))}
              <button className="btn-ghost">{t.tuning.compare}</button>
            </form>
          )}
          {a && b && <CompareTable a={a} b={b} stock={stock} label={label} withUnit={withUnit} sheetName={sheetName} t={t} />}

          {/* History */}
          <h2 className="pt-2 font-semibold">{t.tuning.history}</h2>
          <ul className="space-y-3">
            {history.map(({ sheet, changes }) => (
              <li key={sheet.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      {[formatDate(sheet.sheetDate, lang), sheet.engineHours != null ? `${sheet.engineHours} h` : null, sheet.authorName].filter(Boolean).join(" · ")}
                    </p>
                    <h3 className="font-semibold">{sheet.title}</h3>
                  </div>
                  <Stars n={sheet.rating} className="shrink-0 text-sm" />
                </div>
                <Conditions sheet={sheet} t={t} />
                <ChangeList changes={changes} label={label} withUnit={withUnit} t={t} />
                {sheet.notes && <p className="mt-2 whitespace-pre-line text-sm text-muted">{sheet.notes}</p>}
                {editable && (
                  <div className="mt-3 flex gap-3 text-xs">
                    <Link href={`/garage/${vehicleId}/tuning/${sheet.id}`} className="text-accent hover:underline">
                      ✎ {t.tuning.edit}
                    </Link>
                    <Link href={`/garage/${vehicleId}/tuning/new?from=${sheet.id}`} className="text-muted hover:text-foreground">
                      ⧉ {t.tuning.duplicate}
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

type Dict = Awaited<ReturnType<typeof getI18n>>["t"];

function Conditions({ sheet, t }: { sheet: TuningSheet; t: Dict }) {
  const chips = [
    sheet.track && `📍 ${sheet.track}`,
    sheet.surface && (t.tuning.surfaces[sheet.surface as keyof Dict["tuning"]["surfaces"]] ?? sheet.surface),
    sheet.weather && `☁ ${sheet.weather}`,
    sheet.tempC != null && `🌡 ${sheet.tempC} °C`,
    sheet.altitudeM != null && `⛰ ${sheet.altitudeM} m`,
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="chip bg-surface-2 text-muted">
          {c}
        </span>
      ))}
    </div>
  );
}

function ChangeList({
  changes,
  label,
  withUnit,
  t,
}: {
  changes: Change[] | null;
  label: (k: string) => string;
  withUnit: (k: string, v: string) => string;
  t: Dict;
}) {
  if (changes == null) return <p className="mt-2 text-xs text-muted">{t.tuning.firstSheet}</p>;
  if (!changes.length) return <p className="mt-2 text-xs text-muted">{t.tuning.noChanges}</p>;
  return (
    <div className="mt-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{t.tuning.changes}: </span>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {changes.map((c) => (
          <li key={c.field.key} className="chip bg-amber-950/50 text-amber-200">
            {label(c.field.key)}: <span className="text-muted line-through decoration-1">{c.from || "—"}</span> → {withUnit(c.field.key, c.to) || "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompareTable({
  a,
  b,
  stock,
  label,
  withUnit,
  sheetName,
  t,
}: {
  a: TuningSheet;
  b: TuningSheet;
  stock: StockSetup | null;
  label: (k: string) => string;
  withUnit: (k: string, v: string) => string;
  sheetName: (s: TuningSheet) => string;
  t: Dict;
}) {
  const changed = new Set(diffSettings(a.settings, b.settings).map((c) => c.field.key));
  const keys = TUNING_FIELDS.filter((f) => a.settings[f.key] || b.settings[f.key]).map((f) => f.key);
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium uppercase tracking-wide">{t.tuning.setting}</th>
              {[a, b].map((s) => (
                <th key={s.id} className="px-3 py-2 font-medium">
                  {sheetName(s)} <Stars n={s.rating} />
                </th>
              ))}
              {stock && <th className="px-3 py-2 font-medium uppercase tracking-wide">{t.tuning.stock}</th>}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className={`border-t border-border ${changed.has(k) ? "bg-amber-950/30" : ""}`}>
                <td className="px-3 py-1.5 text-muted">{label(k)}</td>
                <td className={`px-3 py-1.5 ${changed.has(k) ? "font-semibold" : ""}`}>{withUnit(k, a.settings[k] ?? "") || "—"}</td>
                <td className={`px-3 py-1.5 ${changed.has(k) ? "font-semibold text-accent" : ""}`}>{withUnit(k, b.settings[k] ?? "") || "—"}</td>
                {stock && <td className="px-3 py-1.5 text-muted">{stock.values[k] ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
