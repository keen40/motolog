"use client";

import Link from "next/link";
import { useState } from "react";
import { fill, useI18n } from "@/lib/i18n/client";
import type { ScheduleRow } from "@/lib/schedule";
import type { VehicleEvent, ZoneId } from "@/lib/types";
import { formatDate, formatMoney, KIND_COLORS } from "@/lib/zones";
import { BikeDiagram, type ZoneState } from "./BikeDiagram";

type Props = {
  vehicleId: string;
  events: VehicleEvent[];
  states: Partial<Record<ZoneId, ZoneState>>;
  counts: Partial<Record<ZoneId, number>>;
  schedule: ScheduleRow[];
  currentHours: number | null;
  editable: boolean;
};

export function OverviewPanel({ vehicleId, events, states, counts, schedule, currentHours, editable }: Props) {
  const { t, lang } = useI18n();
  const [zone, setZone] = useState<ZoneId | null>(null);
  const list = (zone ? events.filter((e) => e.zone === zone) : events).slice(0, 8);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="card p-4 lg:col-span-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{t.diagram.title}</h2>
          <p className="text-xs text-muted">{t.diagram.hint}</p>
        </div>
        <BikeDiagram states={states} counts={counts} selected={zone} onSelect={setZone} />
      </div>

      <div className="space-y-4 lg:col-span-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{zone ? t.zones[zone] : t.diagram.allZones}</h2>
            {zone && (
              <div className="flex gap-2 text-xs">
                <Link href={`/garage/${vehicleId}?tab=specs&zone=${zone}`} className="text-accent hover:underline">
                  {t.parts.title} →
                </Link>
                <button onClick={() => setZone(null)} className="text-muted hover:text-foreground">
                  ✕
                </button>
              </div>
            )}
          </div>
          {list.length === 0 ? (
            <p className="text-sm text-muted">{zone ? t.diagram.nothing : t.timeline.empty}</p>
          ) : (
            <ul className="space-y-2">
              {list.map((e) => (
                <li key={e.id}>
                  <Link href={editable ? `/garage/${vehicleId}/log/${e.id}` : `/garage/${vehicleId}?tab=timeline`} className="flex items-start gap-3 rounded-xl p-2 hover:bg-surface-2">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: KIND_COLORS[e.kind] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.title}</span>
                      <span className="block text-xs text-muted">
                        {e.kind === "plan" ? t.planStatus[e.planStatus ?? "idea"] : t.kinds[e.kind]}
                        {e.eventDate && ` · ${formatDate(e.eventDate, lang)}`}
                        {e.engineHours != null && ` · ${e.engineHours} h`}
                      </span>
                    </span>
                    {e.cost ? <span className="text-xs text-muted">{formatMoney(Number(e.cost), e.currency, lang)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <Link href={`/garage/${vehicleId}/log${zone ? `?zone=${zone}` : ""}`} className="btn-ghost mt-3 w-full text-xs">
              + {t.bike.logEntry}
            </Link>
          )}
        </div>

        {schedule.length > 0 && (
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">{t.stats.upcoming}</h2>
            {currentHours == null && <p className="mb-2 text-xs text-muted">{t.stats.noHours}</p>}
            <ul className="space-y-2">
              {schedule.map((row) => (
                <ScheduleBar key={row.interval.id} row={row} />
              ))}
            </ul>
            <Link href={`/garage/${vehicleId}?tab=stats`} className="mt-3 block text-xs text-accent hover:underline">
              {t.bike.tabs.stats} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScheduleBar({ row }: { row: ScheduleRow }) {
  const { t, lang } = useI18n();
  const total = Number(row.interval.intervalHours ?? 0);
  const pct = row.remaining == null || !total ? 0 : Math.min(100, Math.max(0, ((total - row.remaining) / total) * 100));
  const overdue = row.remaining != null && row.remaining < 0;
  const color = overdue ? "#f87171" : pct > 75 ? "#f59e0b" : "#34d399";
  return (
    <li>
      <div className="flex justify-between text-sm">
        <span>{lang === "hu" ? row.interval.labelHu : row.interval.labelEn}</span>
        <span className={`text-xs ${row.remaining == null ? "text-muted" : ""}`} style={{ color: row.remaining == null ? undefined : color }}>
          {row.remaining == null ? (row.lastDate || row.lastHours != null ? "" : t.stats.never) : overdue ? `${t.stats.overdue} (${-row.remaining} h)` : fill(t.stats.inHours, { n: row.remaining })}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${row.remaining == null ? 0 : overdue ? 100 : pct}%`, background: color }} />
      </div>
    </li>
  );
}
