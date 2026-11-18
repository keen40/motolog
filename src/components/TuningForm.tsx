import Link from "next/link";
import { saveTuningSheet } from "@/app/garage/actions";
import { getI18n } from "@/lib/i18n";
import { SURFACES, TUNING_FIELDS, TUNING_GROUPS, unitLabel } from "@/lib/tuning";
import type { StockSetup } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

export type TuningFormValues = {
  title: string;
  sheetDate: string | null;
  engineHours: number | null;
  track: string | null;
  surface: string | null;
  weather: string | null;
  tempC: number | null;
  altitudeM: number | null;
  settings: Record<string, string>;
  rating: number | null;
  notes: string | null;
};

type Props = {
  vehicleId: string;
  sheetId: string | null;
  initial: TuningFormValues;
  stock: StockSetup | null;
};

export async function TuningForm({ vehicleId, sheetId, initial, stock }: Props) {
  const { t, lang } = await getI18n();

  return (
    <form action={saveTuningSheet.bind(null, vehicleId, sheetId)} className="card space-y-6 p-4 sm:p-6">
      <div className="grid items-end grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            {t.tuning.sheetTitle}
          </label>
          <input id="title" name="title" required defaultValue={initial.title} placeholder={t.tuning.sheetTitlePh} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="sheet_date">
            {t.tuning.date}
          </label>
          <input id="sheet_date" name="sheet_date" type="date" defaultValue={initial.sheetDate ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="engine_hours">
            {t.tuning.hours}
          </label>
          <input id="engine_hours" name="engine_hours" type="number" step="0.1" min={0} inputMode="decimal" defaultValue={initial.engineHours ?? ""} className="input" />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">{t.tuning.conditions}</legend>
        <div className="grid items-end grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="col-span-2">
            <label className="label" htmlFor="track">
              {t.tuning.track}
            </label>
            <input id="track" name="track" defaultValue={initial.track ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="surface">
              {t.tuning.surface}
            </label>
            <select id="surface" name="surface" defaultValue={initial.surface ?? ""} className="input">
              <option value="">—</option>
              {SURFACES.map((s) => (
                <option key={s} value={s}>
                  {t.tuning.surfaces[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="temp_c">
              {t.tuning.temp}
            </label>
            <input id="temp_c" name="temp_c" type="number" step="1" inputMode="numeric" defaultValue={initial.tempC ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="altitude_m">
              {t.tuning.altitude}
            </label>
            <input id="altitude_m" name="altitude_m" type="number" step="10" inputMode="numeric" defaultValue={initial.altitudeM ?? ""} className="input" />
          </div>
          <div className="col-span-2 sm:col-span-5">
            <label className="label" htmlFor="weather">
              {t.tuning.weather}
            </label>
            <input id="weather" name="weather" defaultValue={initial.weather ?? ""} className="input" />
          </div>
        </div>
      </fieldset>

      {TUNING_GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="mb-2 font-semibold">{t.tuning.groups[g]}</legend>
          {(g === "fork" || g === "shock") && <p className="-mt-1 mb-2 text-xs text-muted">{t.tuning.clicksOutHint}</p>}
          <div className="grid items-end grid-cols-2 gap-3 sm:grid-cols-3">
            {TUNING_FIELDS.filter((f) => f.group === g).map((f) => {
              const s = stock?.values[f.key];
              const unit = unitLabel(f.unit, lang);
              return (
                <div key={f.key}>
                  <label className="label truncate" htmlFor={`set_${f.key}`}>
                    {lang === "hu" ? f.hu : f.en}
                    {unit && <span className="normal-case"> ({unit})</span>}
                  </label>
                  <input
                    id={`set_${f.key}`}
                    name={`set_${f.key}`}
                    defaultValue={initial.settings[f.key] ?? ""}
                    placeholder={s ? `${t.tuning.stock}: ${s}` : ""}
                    inputMode={f.numeric ? "decimal" : undefined}
                    maxLength={80}
                    className="input"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="mb-2 font-semibold">{t.tuning.rating}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-2 text-xl text-muted has-checked:border-accent has-checked:text-accent"
            >
              <input type="radio" name="rating" value={n} defaultChecked={initial.rating === n} className="sr-only" />
              {n}★
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="notes">
          {t.tuning.notes}
        </label>
        <textarea id="notes" name="notes" rows={4} defaultValue={initial.notes ?? ""} placeholder={t.tuning.notesPh} className="input" />
      </div>

      <div className="flex justify-end gap-2">
        <Link href={`/garage/${vehicleId}?tab=tuning`} className="btn-ghost">
          {t.common.cancel}
        </Link>
        <SubmitButton>{t.tuning.save}</SubmitButton>
      </div>
    </form>
  );
}
