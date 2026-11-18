import Link from "next/link";
import { OverviewPanel } from "@/components/OverviewPanel";
import { PlanBoard } from "@/components/PlanBoard";
import { ScheduleTable } from "@/components/ScheduleTable";
import { SharePanel } from "@/components/SharePanel";
import { SpecsPanel } from "@/components/SpecsPanel";
import { StatsCharts } from "@/components/StatsCharts";
import { Timeline } from "@/components/Timeline";
import { deleteVehicle, updateVehicleHours } from "@/app/garage/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { canEdit, requireVehicle } from "@/lib/access";
import { listKnownUsers, loadEvents, loadIntervals, loadModel, loadParts, loadShares, loadShops, loadSpecs } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { photoUrl } from "@/lib/photos";
import { buildSchedule, zoneStates } from "@/lib/schedule";
import type { ZoneId } from "@/lib/types";
import { formatMoney, ZONES } from "@/lib/zones";

const TABS = ["overview", "timeline", "plans", "stats", "specs"] as const;
type Tab = (typeof TABS)[number];

export default async function BikePage({ params, searchParams }: PageProps<"/garage/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const { lang, t } = await getI18n();
  const { user, vehicle, role } = await requireVehicle(id);
  const editable = canEdit(role);

  const events = loadEvents(id);
  const model = loadModel(vehicle.modelId);
  const intervals = loadIntervals(vehicle.modelId);
  const photos = Object.fromEntries(
    [vehicle.photoId, ...events.flatMap((e) => e.photoIds)].filter(Boolean).map((p) => [p!, photoUrl(p!)]),
  );
  const schedule = buildSchedule(intervals, events, vehicle.engineHours);
  const { states, counts } = zoneStates(events);

  const done = events.filter((e) => e.kind !== "plan");
  const spent = new Map<string, number>();
  for (const e of done) if (e.cost) spent.set(e.currency, (spent.get(e.currency) ?? 0) + Number(e.cost));
  const kpis = [
    { label: t.bike.totalSpent, value: spent.size ? [...spent].map(([c, s]) => formatMoney(s, c, lang)).join(" + ") : "—" },
    { label: t.bike.entries, value: String(done.length) },
    { label: t.bike.mods, value: String(done.filter((e) => e.kind === "mod").length) },
    { label: t.bike.planned, value: String(events.filter((e) => e.kind === "plan").length) },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Bike header */}
      <div className="card flex flex-col overflow-hidden md:flex-row">
        {vehicle.photoId && photos[vehicle.photoId] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[vehicle.photoId]} alt="" className="h-36 w-full object-cover sm:h-48 md:h-auto md:w-72" />
        )}
        <div className="flex flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                {vehicle.year} · {vehicle.make}
                {model?.engineCc && ` · ${model.engineCc} cc ${model.stroke ? `${model.stroke}T` : ""}`}
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                {vehicle.model}
                {vehicle.nickname && <span className="text-lg font-normal text-muted sm:text-xl"> “{vehicle.nickname}”</span>}
              </h1>
              {model && <p className="mt-1 hidden max-w-xl text-sm text-muted sm:block">{lang === "hu" ? model.summaryHu : model.summaryEn}</p>}
            </div>
            {editable && (
              <div className="flex shrink-0 gap-2">
                <Link href={`/garage/${id}/edit`} className="btn-ghost" aria-label={t.bike.edit}>
                  ✎ <span className="hidden sm:inline">{t.bike.edit}</span>
                </Link>
                <Link href={`/garage/${id}/log`} className="btn-primary hidden sm:inline-flex">
                  + {t.bike.logEntry}
                </Link>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="min-w-0 rounded-xl bg-surface-2 p-2 sm:p-3">
                <p className="truncate text-[10px] text-muted sm:text-xs">{k.label}</p>
                <p className="truncate text-sm font-semibold sm:text-lg">{k.value}</p>
              </div>
            ))}
          </div>
          {!editable && <p className="text-xs text-muted">🔒 {t.share.readOnly}</p>}
          {editable && (
          <form action={updateVehicleHours.bind(null, id)} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:flex">
            <div>
              <label className="label" htmlFor="engine_hours">
                {t.bike.currentHours}
              </label>
              <input id="engine_hours" name="engine_hours" type="number" step="0.1" min={0} inputMode="decimal" defaultValue={vehicle.engineHours ?? ""} className="input sm:w-32" />
            </div>
            <div>
              <label className="label" htmlFor="odometer_km">
                {t.newBike.km}
              </label>
              <input id="odometer_km" name="odometer_km" type="number" min={0} inputMode="numeric" defaultValue={vehicle.odometerKm ?? ""} className="input sm:w-32" />
            </div>
            <SubmitButton className="btn-ghost">
              <span className="sm:hidden">✓</span>
              <span className="hidden sm:inline">{t.bike.updateHours}</span>
            </SubmitButton>
          </form>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/garage/${id}?tab=${key}`}
            scroll={false}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium sm:px-4 ${
              tab === key ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.bike.tabs[key]}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewPanel vehicleId={id} events={events} states={states} counts={counts} schedule={schedule.slice(0, 4)} currentHours={vehicle.engineHours} editable={editable} />
      )}
      {tab === "timeline" && <Timeline vehicleId={id} events={done} photos={photos} kind={typeof sp.kind === "string" ? sp.kind : null} editable={editable} />}
      {tab === "plans" && <PlanBoard vehicleId={id} events={events.filter((e) => e.kind === "plan" || e.planStatus === "done")} editable={editable} />}
      {tab === "stats" && (
        <div className="space-y-6">
          <StatsCharts events={done} />
          {intervals.length > 0 && <ScheduleTable schedule={schedule} currentHours={vehicle.engineHours} />}
        </div>
      )}
      {tab === "specs" &&
        (model ? (
          <SpecsPanel vehicleId={id} model={model} specs={loadSpecs(model.id)} parts={loadParts(model.id)} shops={loadShops()} userId={user.id} zone={ZONES.includes(sp.zone as ZoneId) ? (sp.zone as ZoneId) : null} />
        ) : (
          <p className="card p-6 text-muted">{t.bike.noModel}</p>
        ))}

      {editable && (
        <Link
          href={`/garage/${id}/log`}
          aria-label={t.bike.logEntry}
          className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light text-black shadow-lg shadow-black/50 sm:hidden"
        >
          +
        </Link>
      )}

      {role === "owner" && (
        <div className="space-y-4 pt-6">
          <SharePanel vehicleId={id} shares={loadShares(id)} knownUsers={listKnownUsers().filter((u) => u.email !== user.email)} />
          <div className="flex justify-end">
            <form action={deleteVehicle.bind(null, id)}>
              <ConfirmButton message={t.bike.deleteConfirm} className="btn-danger text-xs">
                {t.bike.delete}
              </ConfirmButton>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
