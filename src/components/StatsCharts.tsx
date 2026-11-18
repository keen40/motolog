"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/client";
import type { EventKind, VehicleEvent } from "@/lib/types";
import { formatMoney, KIND_COLORS } from "@/lib/zones";

const tooltipStyle = {
  contentStyle: { background: "#1f1f25", border: "1px solid #2a2a32", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "#ededf0" },
  itemStyle: { color: "#ededf0" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

export function StatsCharts({ events }: { events: VehicleEvent[] }) {
  const { t, lang } = useI18n();

  // Charts use the most common currency; entries in other currencies are left out of money charts.
  const currencyCount = new Map<string, number>();
  for (const e of events) if (e.cost) currencyCount.set(e.currency, (currencyCount.get(e.currency) ?? 0) + 1);
  const currency = [...currencyCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "HUF";
  const priced = events.filter((e) => e.cost && e.currency === currency);
  const money = (v: number) => formatMoney(v, currency, lang);

  const byZone = Object.entries(
    priced.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.zone]: (acc[e.zone] ?? 0) + Number(e.cost) }), {}),
  )
    .map(([zone, value]) => ({ name: t.zones[zone as keyof typeof t.zones], value }))
    .sort((a, b) => b.value - a.value);

  const byMonth = Object.entries(
    priced
      .filter((e) => e.eventDate)
      .reduce<Record<string, number>>((acc, e) => {
        const m = e.eventDate!.slice(0, 7);
        return { ...acc, [m]: (acc[m] ?? 0) + Number(e.cost) };
      }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));

  const byKind = (["service", "mod", "repair"] as EventKind[])
    .map((k) => ({ name: t.kinds[k], kind: k, value: events.filter((e) => e.kind === k).length }))
    .filter((d) => d.value > 0);

  if (!events.length) return <div className="card p-10 text-center text-muted">{t.stats.noData}</div>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">{t.stats.byCategory}</h3>
        {byZone.length ? (
          <ResponsiveContainer width="100%" height={Math.max(160, byZone.length * 36)}>
            <BarChart data={byZone} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#9a9aa6", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => money(Number(v))} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted">{t.stats.noData}</p>
        )}
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-semibold">{t.stats.byKind}</h3>
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="50%" height={200}>
            <PieChart>
              <Pie data={byKind} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                {byKind.map((d) => (
                  <Cell key={d.kind} fill={KIND_COLORS[d.kind]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-2 text-sm">
            {byKind.map((d) => (
              <li key={d.kind} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: KIND_COLORS[d.kind] }} />
                {d.name}
                <span className="text-muted">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-4 lg:col-span-2">
        <h3 className="mb-3 font-semibold">{t.stats.byMonth}</h3>
        {byMonth.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth}>
              <CartesianGrid vertical={false} stroke="#2a2a32" />
              <XAxis dataKey="month" tick={{ fill: "#9a9aa6", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9a9aa6", fontSize: 11 }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => money(Number(v))} />
              <Tooltip {...tooltipStyle} formatter={(v) => money(Number(v))} />
              <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted">{t.stats.noData}</p>
        )}
      </div>
    </div>
  );
}
