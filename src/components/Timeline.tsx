import Link from "next/link";
import { fill, getI18n } from "@/lib/i18n";
import type { EventKind, VehicleEvent } from "@/lib/types";
import { formatDate, formatMoney, KIND_COLORS } from "@/lib/zones";

type Props = { vehicleId: string; events: VehicleEvent[]; photos: Record<string, string>; kind: string | null; editable: boolean };

export async function Timeline({ vehicleId, events, photos, kind, editable }: Props) {
  const { t, lang } = await getI18n();
  const kinds: EventKind[] = ["service", "mod", "repair"];
  const list = kind ? events.filter((e) => e.kind === kind) : events;

  // Group by year
  const groups = new Map<string, VehicleEvent[]>();
  for (const e of list) {
    const y = e.eventDate?.slice(0, 4) ?? "—";
    groups.set(y, [...(groups.get(y) ?? []), e]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <FilterChip href={`/garage/${vehicleId}?tab=timeline`} active={!kind} label={t.timeline.filterAll} />
        {kinds.map((k) => (
          <FilterChip key={k} href={`/garage/${vehicleId}?tab=timeline&kind=${k}`} active={kind === k} label={t.kinds[k]} color={KIND_COLORS[k]} />
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-muted">{t.timeline.empty}</div>
      ) : (
        [...groups].map(([year, items]) => (
          <section key={year}>
            <h3 className="mb-3 text-sm font-semibold text-muted">{year}</h3>
            <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
              {items.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className="absolute -left-[33px] top-4 h-4 w-4 rounded-full border-4 border-background"
                    style={{ background: KIND_COLORS[e.kind] }}
                  />
                  <Link href={editable ? `/garage/${vehicleId}/log/${e.id}` : "#"} className={`card block p-4 transition-colors ${editable ? "hover:border-accent" : "pointer-events-none"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="chip" style={{ background: `${KIND_COLORS[e.kind]}22`, color: KIND_COLORS[e.kind] }}>
                            {t.kinds[e.kind]}
                          </span>
                          <span className="chip bg-surface-2 text-muted">{t.zones[e.zone]}</span>
                        </div>
                        <h4 className="font-semibold">{e.title}</h4>
                      </div>
                      <div className="text-sm sm:text-right">
                        {e.cost ? <p className="font-semibold">{formatMoney(Number(e.cost), e.currency, lang)}</p> : null}
                        <p className="text-xs text-muted">
                          {e.authorName && <span>{fill(t.event.by, { name: e.authorName })} · </span>}
                          {formatDate(e.eventDate, lang)}
                          {e.engineHours != null && ` · ${e.engineHours} h`}
                          {e.odometerKm != null && ` · ${e.odometerKm} km`}
                        </p>
                      </div>
                    </div>
                    {e.description && <p className="mt-2 whitespace-pre-line text-sm text-muted">{e.description}</p>}
                    {e.parts.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {e.parts.map((p, i) => (
                          <li key={i} className="rounded-lg bg-surface-2 px-2 py-1 text-xs">
                            {p.qty && p.qty > 1 ? `${p.qty}× ` : ""}
                            {p.brand && <span className="text-muted">{p.brand} </span>}
                            {p.name}
                            {p.part_number && <span className="font-mono text-muted"> #{p.part_number}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {e.photoIds.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {e.photoIds.map((p) =>
                          photos[p] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={p} src={photos[p]} alt="" className="h-24 w-32 shrink-0 rounded-lg object-cover" />
                          ) : null,
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

function FilterChip({ href, active, label, color }: { href: string; active: boolean; label: string; color?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`chip border px-3 py-1 ${active ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted hover:text-foreground"}`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </Link>
  );
}
