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
    <div className="space-y-6">
      {/* Bike header */}
      <div className="card flex flex-col gap-5 overflow-hidden md:flex-row">
        {vehicle.photoId && photos[vehicle.photoId] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[vehicle.photoId]} alt="" className="h-48 w-full object-cover md:h-auto md:w-72" />
        )}
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                {vehicle.year} · {vehicle.make}
                {model?.engineCc && ` · ${model.engineCc} cc ${model.stroke ? `${model.stroke}T` : ""}`}
              </p>
              <h1 className="text-3xl font-bold">
                {vehicle.model}
                {vehicle.nickname && <span className="text-xl font-normal text-muted"> “{vehicle.nickname}”</span>}
              </h1>
              {model && <p className="mt-1 max-w-xl text-sm text-muted">{lang === "hu" ? model.summaryHu : model.summaryEn}</p>}
            </div>
            {editable && (
              <Link href={`/garage/${id}/log`} className="btn-primary">
                + {t.bike.logEntry}
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs text-muted">{k.label}</p>
                <p className="text-lg font-semibold">{k.value}</p>
              </div>
            ))}
          </div>
          {!editable && <p className="text-xs text-muted">🔒 {t.share.readOnly}</p>}
          {editable && (
          <form action={updateVehicleHours.bind(null, id)} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="engine_hours">
                {t.bike.currentHours}
              </label>
              <input id="engine_hours" name="engine_hours" type="number" step="0.1" min={0} defaultValue={vehicle.engineHours ?? ""} className="input w-32" />
            </div>
            <div>
              <label className="label" htmlFor="odometer_km">
                {t.newBike.km}
              </label>
              <input id="odometer_km" name="odometer_km" type="number" min={0} defaultValue={vehicle.odometerKm ?? ""} className="input w-32" />
            </div>
            <SubmitButton className="btn-ghost">{t.bike.updateHours}</SubmitButton>
          </form>
          )}
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/garage/${id}?tab=${key}`}
            scroll={false}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
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
