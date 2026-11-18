import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import type { Ride } from "@/lib/types";
import { formatDate } from "@/lib/zones";
import { PremixCalculator } from "./PremixCalculator";

type Props = {
  vehicleId: string;
  rides: Ride[];
  editable: boolean;
  premix: { ratio: number | null; source: "sheet" | "stock" | null } | null;
};

export async function RidesPanel({ vehicleId, rides, editable, premix }: Props) {
  const { t, lang } = await getI18n();
  const year = new Date().getFullYear().toString();
  const total = rides.reduce((a, r) => a + r.durationH, 0);
  const thisYear = rides.filter((r) => r.rideDate.startsWith(year)).reduce((a, r) => a + r.durationH, 0);
  const h = (n: number) => `${Math.round(n * 10) / 10} ${t.rides.h}`;
  const stats = [
    [t.rides.total, String(rides.length)],
    [t.rides.totalHours, h(total)],
    [t.rides.thisYear, h(thisYear)],
    // Short date so it fits the small tile on phones ("nov. 15.").
    [t.rides.last, rides[0] ? new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : "en-GB", { month: "short", day: "numeric" }).format(new Date(rides[0].rideDate)) : "—"],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted">{t.rides.intro}</p>
          {editable && (
            <Link href={`/garage/${vehicleId}/ride`} className="btn-primary">
              🏁 {t.rides.add}
            </Link>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-xl bg-surface-2 p-2 sm:p-3">
              <p className="truncate text-[10px] text-muted sm:text-xs">{k}</p>
              <p className="truncate text-sm font-semibold sm:text-lg">{v}</p>
            </div>
          ))}
        </div>

        {rides.length === 0 ? (
          <div className="card p-8 text-center text-muted">{t.rides.empty}</div>
        ) : (
          <ul className="card divide-y divide-border">
            {rides.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{formatDate(r.rideDate, lang)}</span>
                    {r.track && <span className="text-muted"> · 📍 {r.track}</span>}
                    {r.surface && <span className="text-muted"> · {t.tuning.surfaces[r.surface as keyof typeof t.tuning.surfaces] ?? r.surface}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[
                      r.tuningSheetTitle && (
                        <Link key="s" href={`/garage/${vehicleId}?tab=tuning`} className="text-accent hover:underline">
                          🔧 {r.tuningSheetTitle}
                        </Link>
                      ),
                      r.fuelL != null && <span key="f">⛽ {r.fuelL} L</span>,
                      r.authorName && <span key="a">{r.authorName}</span>,
                    ]
                      .filter(Boolean)
                      .flatMap((el, i) => (i ? [<span key={`d${i}`}> · </span>, el] : [el]))}
                  </p>
                  {r.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.notes}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-lg bg-surface-2 px-2 py-1 text-sm font-semibold">{h(r.durationH)}</span>
                  {editable && (
                    <Link href={`/garage/${vehicleId}/ride/${r.id}`} className="text-xs text-muted hover:text-foreground" aria-label={t.rides.edit}>
                      ✎
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {premix && (
        <div className="lg:col-span-1">
          <PremixCalculator ratio={premix.ratio} source={premix.source} />
        </div>
      )}
    </div>
  );
}
