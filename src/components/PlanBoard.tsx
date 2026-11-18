"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setPlanStatus } from "@/app/garage/actions";
import { useI18n } from "@/lib/i18n/client";
import type { PlanStatus, VehicleEvent } from "@/lib/types";
import { formatMoney, KIND_COLORS } from "@/lib/zones";

const COLUMNS: PlanStatus[] = ["idea", "ordered", "done"];
const COLUMN_COLORS: Record<PlanStatus, string> = { idea: KIND_COLORS.plan, ordered: "#38bdf8", done: KIND_COLORS.mod };

export function PlanBoard({ vehicleId, events, editable }: { vehicleId: string; events: VehicleEvent[]; editable: boolean }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState(events);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<PlanStatus | null>(null);
  const [, startTransition] = useTransition();

  const move = (id: string, status: PlanStatus) => {
    const current = items.find((e) => e.id === id);
    if (!current || (current.planStatus ?? "idea") === status) return;
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, planStatus: status, kind: status === "done" ? "mod" : "plan" } : e)));
    startTransition(() => setPlanStatus(vehicleId, id, status));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted">{t.plans.empty}</p>
        {editable && (
          <Link href={`/garage/${vehicleId}/log?kind=plan`} className="btn-primary shrink-0 whitespace-nowrap">
            + {t.plans.add}
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = items.filter((e) => (e.planStatus ?? "idea") === col);
          const total = cards.reduce((s, e) => s + Number(e.cost ?? 0), 0);
          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                if (dragId) move(dragId, col);
                setDragId(null);
                setOver(null);
              }}
              className={`min-h-48 rounded-2xl border-2 border-dashed p-3 transition-colors ${
                over === col ? "border-accent bg-accent/5" : "border-border bg-surface/50"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLUMN_COLORS[col] }} />
                  {t.planStatus[col]}
                  <span className="text-xs font-normal text-muted">{cards.length}</span>
                </h3>
                {total > 0 && cards[0] && (
                  <span className="text-xs text-muted">
                    {col !== "done" && `${t.plans.estimated} `}
                    {formatMoney(total, cards[0].currency, lang)}
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {cards.map((e) => (
                  <li
                    key={e.id}
                    draggable={editable}
                    onDragStart={() => setDragId(e.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`card cursor-grab p-3 active:cursor-grabbing ${dragId === e.id ? "opacity-40" : ""}`}
                  >
                    <Link href={editable ? `/garage/${vehicleId}/log/${e.id}` : `/garage/${vehicleId}?tab=plans`} className="block font-medium hover:text-accent">
                      {e.title}
                    </Link>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span>{t.zones[e.zone]}</span>
                      {e.cost ? <span>{formatMoney(Number(e.cost), e.currency, lang)}</span> : null}
                    </div>
                    <div className="mt-2 flex gap-1">
                      {editable && COLUMNS.filter((c) => c !== col).map((c) => (
                        <button key={c} onClick={() => move(e.id, c)} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted hover:text-foreground">
                          → {t.planStatus[c]}
                        </button>
                      ))}
                      <Link
                        href={`/garage/${vehicleId}?tab=specs&zone=${e.zone}`}
                        className="ml-auto rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-accent"
                        title={t.parts.whereToBuy}
                      >
                        🛒
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
