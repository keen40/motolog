"use client";

import { useState } from "react";
import { createVehicle } from "@/app/garage/actions";
import { useI18n } from "@/lib/i18n/client";
import { SubmitButton } from "./SubmitButton";

type ModelOption = { id: string; make: string; model: string; yearFrom: number; yearTo: number; engineCc: number | null };

export function NewBikeForm({ models }: { models: ModelOption[] }) {
  const { t } = useI18n();
  const [modelId, setModelId] = useState<string>(models[0]?.id ?? "");
  const custom = modelId === "";
  const selected = models.find((m) => m.id === modelId);

  return (
    <form action={createVehicle} className="card space-y-5 p-6">
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
        <p className="mt-1 text-xs text-muted">{t.newBike.catalogHint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.newBike.make} name="make" required={custom} disabled={!custom} defaultValue={selected?.make} key={`make-${modelId}`} />
        <Field label={t.newBike.model} name="model" required={custom} disabled={!custom} defaultValue={selected?.model} key={`model-${modelId}`} />
        <Field
          label={t.newBike.year}
          name="year"
          type="number"
          required
          min={1950}
          max={2100}
          defaultValue={selected?.yearFrom}
          key={`year-${modelId}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.newBike.nickname} name="nickname" />
        <Field label={t.newBike.vin} name="vin" />
        <Field label={t.newBike.hours} name="engine_hours" type="number" step="0.1" min={0} />
        <Field label={t.newBike.km} name="odometer_km" type="number" min={0} />
        <Field label={t.newBike.purchaseDate} name="purchase_date" type="date" />
        <div>
          <label className="label" htmlFor="photo">
            {t.newBike.photo}
          </label>
          <input id="photo" name="photo" type="file" accept="image/*" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-border file:px-2 file:py-1 file:text-foreground" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">
          {t.newBike.notes}
        </label>
        <textarea id="notes" name="notes" rows={3} className="input" />
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
      <input id={name} name={name} className="input disabled:opacity-60" {...rest} />
    </div>
  );
}
