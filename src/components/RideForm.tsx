import Link from "next/link";
import { saveRide } from "@/app/garage/actions";
import { getI18n } from "@/lib/i18n";
import { SURFACES } from "@/lib/tuning";
import type { TuningSheet } from "@/lib/types";
import { SubmitButton } from "./SubmitButton";

export type RideFormValues = {
  rideDate: string;
  durationH: number | null;
  track: string | null;
  surface: string | null;
  tuningSheetId: string | null;
  fuelL: number | null;
  notes: string | null;
};

type Props = {
  vehicleId: string;
  rideId: string | null;
  initial: RideFormValues;
  sheets: Pick<TuningSheet, "id" | "title" | "sheetDate">[];
  engineHours: number | null;
};

export async function RideForm({ vehicleId, rideId, initial, sheets, engineHours }: Props) {
  const { t } = await getI18n();
  return (
    <form action={saveRide.bind(null, vehicleId, rideId)} className="card space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="ride_date">
            {t.rides.date}
          </label>
          <input id="ride_date" name="ride_date" type="date" required defaultValue={initial.rideDate} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="duration_h">
            {t.rides.duration} *
          </label>
          <input
            id="duration_h"
            name="duration_h"
            type="number"
            required
            min={0.1}
            max={24}
            step={0.1}
            inputMode="decimal"
            autoFocus={!rideId}
            defaultValue={initial.durationH ?? ""}
            className="input"
          />
        </div>
        <p className="col-span-2 -mt-1 text-xs text-muted">
          {t.rides.durationHint}
          {engineHours != null && ` · ${t.bike.currentHours}: ${engineHours} h`}
        </p>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="track">
            {t.rides.track}
          </label>
          <input id="track" name="track" maxLength={80} defaultValue={initial.track ?? ""} className="input" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="surface">
            {t.rides.surface}
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
        {sheets.length > 0 && (
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="tuning_sheet_id">
              {t.rides.sheet}
            </label>
            <select id="tuning_sheet_id" name="tuning_sheet_id" defaultValue={initial.tuningSheetId ?? ""} className="input">
              <option value="">{t.rides.noSheet}</option>
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sheetDate ? `${s.sheetDate} · ` : ""}
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="fuel_l">
            {t.rides.fuel}
          </label>
          <input id="fuel_l" name="fuel_l" type="number" min={0} step={0.1} inputMode="decimal" defaultValue={initial.fuelL ?? ""} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="notes">
            {t.rides.notes}
          </label>
          <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} placeholder={t.rides.notesPh} className="input" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Link href={`/garage/${vehicleId}?tab=rides`} className="btn-ghost">
          {t.common.cancel}
        </Link>
        <SubmitButton>{t.rides.save}</SubmitButton>
      </div>
    </form>
  );
}
