"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { PhotoInput } from "./PhotoInput";
import { SubmitButton } from "./SubmitButton";

type ModelOption = { id: string; make: string; model: string; yearFrom: number; yearTo: number; engineCc: number | null };

export type BikeValues = {
  modelId: string | null;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  vin: string | null;
  engineHours: number | null;
  odometerKm: number | null;
  purchaseDate: string | null;
  notes: string | null;
  photoUrl: string | null;
};

type Props = {
  models: ModelOption[];
  action: (formData: FormData) => void | Promise<void>;
  initial?: BikeValues;
  /** Preselected catalogue model when adding (e.g. coming from the catalogue). */
  defaultModelId?: string;
};

/** Create / edit form for a bike. */
export function BikeForm({ models, action, initial, defaultModelId }: Props) {
  const { t } = useI18n();
  const [modelId, setModelId] = useState<string>(
    initial ? (initial.modelId ?? "") : models.some((m) => m.id === defaultModelId) ? defaultModelId! : (models[0]?.id ?? ""),
  );
  const [removePhoto, setRemovePhoto] = useState(false);
  const custom = modelId === "";
  const selected = models.find((m) => m.id === modelId);

  // When editing, keep the bike's own make/model/year unless the catalogue model is switched.
  const keepOwn = initial && modelId === (initial.modelId ?? "");
  const make = keepOwn ? initial.make : selected?.make;
  const model = keepOwn ? initial.model : selected?.model;
  const year = keepOwn ? initial.year : selected?.yearFrom;

  return (
    <form action={action} className="card space-y-5 p-4 sm:p-6">
      <div>
        <label className="label" htmlFor="model_id">
          {t.newBike.pickModel}
        </label>
        <select id="model_id" name="model_id" className="input" value={modelId} onChange={(e) => setModelId(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.make} {m.model} ({m.yearFrom === m.yearTo ? m.yearFrom : `${m.yearFrom}–${m.yearTo}`})
            </option>
          ))}
          <option value="">{t.newBike.custom}</option>
        </select>
        <p className="mt-1 text-xs text-muted">
          {t.newBike.catalogHint}{" "}
          {!initial && (
            <Link href="/catalogue#lookup" className="text-accent hover:underline">
              {t.catalogue.notListed} {t.catalogue.lookItUp} →
            </Link>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.newBike.make} name="make" required={custom} readOnly={!custom} defaultValue={make} key={`make-${modelId}`} />
        <Field label={t.newBike.model} name="model" required={custom} readOnly={!custom} defaultValue={model} key={`model-${modelId}`} />
        <Field label={t.newBike.year} name="year" type="number" inputMode="numeric" required min={1950} max={2100} defaultValue={year} key={`year-${modelId}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.newBike.nickname} name="nickname" defaultValue={initial?.nickname ?? ""} />
        <Field label={t.newBike.vin} name="vin" defaultValue={initial?.vin ?? ""} />
        <Field label={t.newBike.hours} name="engine_hours" type="number" inputMode="decimal" step="0.1" min={0} defaultValue={initial?.engineHours ?? ""} />
        <Field label={t.newBike.km} name="odometer_km" type="number" inputMode="numeric" min={0} defaultValue={initial?.odometerKm ?? ""} />
        <Field label={t.newBike.purchaseDate} name="purchase_date" type="date" defaultValue={initial?.purchaseDate ?? ""} />
        <div>
          <label className="label" htmlFor="photo">
            {t.newBike.photo}
          </label>
          {initial?.photoUrl && !removePhoto && (
            <div className="mb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={initial.photoUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
              <button type="button" onClick={() => setRemovePhoto(true)} className="text-xs text-muted hover:text-red-400">
                {t.newBike.removePhoto}
              </button>
            </div>
          )}
          {removePhoto && <input type="hidden" name="remove_photo" value="1" />}
          <PhotoInput name="photo" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          {t.newBike.notes}
        </label>
        <textarea id="notes" name="notes" rows={3} className="input" defaultValue={initial?.notes ?? ""} />
      </div>

      <SubmitButton>{t.newBike.save}</SubmitButton>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input read-only:opacity-60" {...rest} />
    </div>
  );
}
