"use client";

import Link from "next/link";
import { useState } from "react";
import { saveEvent } from "@/app/garage/actions";
import { useI18n } from "@/lib/i18n/client";
import type { EventKind, PartLine, PlanStatus, ServiceInterval, VehicleEvent, ZoneId } from "@/lib/types";
import { CURRENCIES, KIND_COLORS, ZONES } from "@/lib/zones";
import { PhotoInput } from "./PhotoInput";
import { SubmitButton } from "./SubmitButton";

type Props = {
  vehicleId: string;
  event: VehicleEvent | null;
  defaults: { kind: EventKind; zone: ZoneId; engine_hours: number | null; odometer_km: number | null };
  intervals: Pick<ServiceInterval, "taskKey" | "zone" | "labelEn" | "labelHu">[];
  photos: Record<string, string>;
};

const KINDS: EventKind[] = ["service", "mod", "repair", "plan"];

export function EventForm({ vehicleId, event, defaults, intervals, photos }: Props) {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState<EventKind>(event?.kind ?? defaults.kind);
  const [zone, setZone] = useState<ZoneId>(event?.zone ?? defaults.zone);
  const [parts, setParts] = useState<PartLine[]>(event?.parts?.length ? event.parts : []);
  const [keep, setKeep] = useState<string[]>(event?.photoIds ?? []);
  const today = new Date().toISOString().slice(0, 10);

  const updatePart = (i: number, patch: Partial<PartLine>) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const partsTotal = parts.reduce((s, p) => s + (p.price ?? 0) * (p.qty ?? 1), 0);
  const zoneTasks = intervals.filter((i) => i.zone === zone);

  return (
    <form action={saveEvent.bind(null, vehicleId, event?.id ?? null)} className="card space-y-5 p-6">
      {/* Kind */}
      <div>
        <span className="label">{t.event.kind}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                kind === k ? "border-transparent text-black" : "border-border text-muted hover:text-foreground"
              }`}
              style={kind === k ? { background: KIND_COLORS[k] } : undefined}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t.kinds[k]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            {t.event.title}
          </label>
          <input id="title" name="title" required defaultValue={event?.title} placeholder={t.event.titlePh} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="zone">
            {t.event.zone}
          </label>
          <select id="zone" name="zone" value={zone} onChange={(e) => setZone(e.target.value as ZoneId)} className="input">
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {t.zones[z]}
              </option>
            ))}
          </select>
        </div>
        {kind === "plan" ? (
          <div>
            <label className="label" htmlFor="plan_status">
              {t.event.status}
            </label>
            <select id="plan_status" name="plan_status" defaultValue={event?.planStatus ?? "idea"} className="input">
              {(["idea", "ordered"] as PlanStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t.planStatus[s]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="task_key">
              {t.event.task}
            </label>
            <select id="task_key" name="task_key" defaultValue={event?.taskKey ?? ""} className="input" key={zone}>
              <option value="">{t.event.taskNone}</option>
              {(zoneTasks.length ? zoneTasks : intervals).map((i) => (
                <option key={i.taskKey} value={i.taskKey}>
                  {lang === "hu" ? i.labelHu : i.labelEn}
                </option>
              ))}
            </select>
          </div>
        )}
        {kind !== "plan" && (
          <>
            <div>
              <label className="label" htmlFor="event_date">
                {t.event.date}
              </label>
              <input id="event_date" name="event_date" type="date" defaultValue={event?.eventDate ?? today} className="input" />
            </div>
            <div className="grid grid-cols-2 items-end gap-2">
              <div>
                <label className="label" htmlFor="engine_hours">
                  {t.event.hours}
                </label>
                <input id="engine_hours" name="engine_hours" type="number" step="0.1" min={0} defaultValue={event?.engineHours ?? defaults.engine_hours ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="odometer_km">
                  {t.event.km}
                </label>
                <input id="odometer_km" name="odometer_km" type="number" min={0} defaultValue={event?.odometerKm ?? defaults.odometer_km ?? ""} className="input" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Parts */}
      <div>
        <span className="label">{t.event.parts}</span>
        <input type="hidden" name="parts" value={JSON.stringify(parts)} />
        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={p.name} onChange={(e) => updatePart(i, { name: e.target.value })} placeholder={t.event.partName} className="input col-span-12 sm:col-span-4" />
              <input value={p.brand ?? ""} onChange={(e) => updatePart(i, { brand: e.target.value })} placeholder={t.event.brand} className="input col-span-6 sm:col-span-2" />
              <input value={p.part_number ?? ""} onChange={(e) => updatePart(i, { part_number: e.target.value })} placeholder={t.event.partNumber} className="input col-span-6 font-mono sm:col-span-2" />
              <input
                type="number"
                min={1}
                value={p.qty ?? 1}
                onChange={(e) => updatePart(i, { qty: Number(e.target.value) || 1 })}
                aria-label={t.event.qty}
                className="input col-span-3 sm:col-span-1"
              />
              <input
                type="number"
                min={0}
                step="any"
                value={p.price ?? ""}
                onChange={(e) => updatePart(i, { price: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder={t.event.price}
                className="input col-span-7 sm:col-span-2"
              />
              <button type="button" onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))} className="col-span-2 text-muted hover:text-red-400 sm:col-span-1">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setParts((ps) => [...ps, { name: "", qty: 1 }])} className="btn-ghost text-xs">
            + {t.event.addPart}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="cost">
            {t.event.cost}
          </label>
          <input
            id="cost"
            name="cost"
            type="number"
            min={0}
            step="any"
            defaultValue={event?.cost ?? ""}
            placeholder={partsTotal ? String(partsTotal) : ""}
            key={partsTotal && !event?.cost ? `auto-${partsTotal}` : "manual"}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="currency">
            {t.event.currency}
          </label>
          <select id="currency" name="currency" defaultValue={event?.currency ?? "HUF"} className="input">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">
          {t.event.description}
        </label>
        <textarea id="description" name="description" rows={4} defaultValue={event?.description ?? ""} className="input" />
      </div>

      {/* Photos */}
      <div>
        <label className="label" htmlFor="photos">
          {t.event.photos}
        </label>
        {keep.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {keep.map((p) => (
              <div key={p} className="relative">
                <input type="hidden" name="keep_photo" value={p} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos[p] && <img src={photos[p]} alt="" className="h-20 w-28 rounded-lg object-cover" />}
                <button
                  type="button"
                  onClick={() => setKeep((k) => k.filter((x) => x !== p))}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <PhotoInput name="photos" multiple />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{t.event.save}</SubmitButton>
        <Link href={`/garage/${vehicleId}`} className="btn-ghost">
          {t.common.cancel}
        </Link>
      </div>
    </form>
  );
}
