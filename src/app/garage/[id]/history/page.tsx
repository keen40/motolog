import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema as s } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { requireVehicle } from "@/lib/access";
import { loadEvents, loadIntervals, loadModel, loadTuningSheets } from "@/lib/data";
import { fill, getI18n } from "@/lib/i18n";
import { buildSchedule } from "@/lib/schedule";
import { dueText, intervalText } from "@/lib/scheduleText";
import { TUNING_FIELDS, TUNING_GROUPS, unitLabel } from "@/lib/tuning";
import { formatDate, formatMoney } from "@/lib/zones";

/** Printable service history for one bike – meant for "Save as PDF" (e.g. when selling). */
export default async function HistoryPage({ params }: PageProps<"/garage/[id]/history">) {
  const { id } = await params;
  const { t, lang } = await getI18n();
  const { vehicle } = await requireVehicle(id);
  const hu = lang === "hu";

  const owner = getDb().select({ name: s.users.name, email: s.users.email }).from(s.users).where(eq(s.users.id, vehicle.ownerId)).get();
  const events = loadEvents(id);
  const done = events.filter((e) => e.kind !== "plan");
  const model = loadModel(vehicle.modelId);
  const intervals = loadIntervals(vehicle.modelId);
  const schedule = buildSchedule(intervals, events, vehicle.engineHours).filter((r) => r.dueAt != null || r.dueDate != null);
  const sheet = loadTuningSheets(id)[0];

  const spent = new Map<string, number>();
  for (const e of done) if (e.cost) spent.set(e.currency, (spent.get(e.currency) ?? 0) + Number(e.cost));
  const firstDate = done.map((e) => e.eventDate).filter(Boolean).sort()[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const facts = [
    [t.history.owner, owner?.name ?? owner?.email],
    [t.history.vin, vehicle.vin],
    [t.history.hours, vehicle.engineHours != null ? `${vehicle.engineHours} h` : null],
    [t.history.km, vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString(hu ? "hu-HU" : "en-GB")} km` : null],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/garage/${id}?tab=timeline`} className="text-sm text-muted hover:text-foreground">
          ← {vehicle.year} {vehicle.make} {vehicle.model}
        </Link>
        <PrintButton label={t.history.print} />
      </div>
      <p className="text-xs text-muted print:hidden">{t.history.printHint}</p>

      {/* The sheet: always light, so it looks the same on screen and on paper. */}
      <article className="space-y-6 rounded-2xl bg-white p-5 text-[13px] leading-snug text-zinc-900 shadow-lg sm:p-8 print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-zinc-900 pb-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">{t.history.title}</p>
            <h1 className="text-2xl font-bold">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.nickname && <span className="font-normal text-zinc-500"> “{vehicle.nickname}”</span>}
            </h1>
            {model?.engineCc && (
              <p className="text-xs text-zinc-500">
                {model.engineCc} cc{model.stroke ? ` · ${model.stroke}T` : ""}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 text-xs">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section className="grid grid-cols-3 gap-3">
          {[
            [t.history.totalSpent, spent.size ? [...spent].map(([c, v]) => formatMoney(v, c, lang)).join(" + ") : "—"],
            [t.history.jobs, String(done.length)],
            [t.history.since, firstDate ? formatDate(firstDate, lang) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-lg border border-zinc-200 p-2.5">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{k}</p>
              <p className="text-sm font-semibold break-words sm:text-base">{v}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold">{t.history.work}</h2>
          {done.length === 0 ? (
            <p className="text-zinc-500">{t.history.none}</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-1.5 pr-3 font-medium">{t.history.date}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.history.work}</th>
                  <th className="py-1.5 text-right font-medium">{t.history.cost}</th>
                </tr>
              </thead>
              <tbody>
                {done.map((e) => (
                  <tr key={e.id} className="break-inside-avoid border-b border-zinc-200 align-top">
                    <td className="w-28 py-2 pr-3 whitespace-nowrap">
                      {e.eventDate ? formatDate(e.eventDate, lang) : "—"}
                      <div className="text-[11px] text-zinc-500">
                        {[e.engineHours != null ? `${e.engineHours} h` : null, e.odometerKm != null ? `${e.odometerKm} km` : null].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="mr-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{t.kinds[e.kind]}</span>
                      <span className="font-semibold">{e.title}</span>
                      <span className="text-zinc-500"> · {t.zones[e.zone]}</span>
                      {e.description && <p className="mt-0.5 whitespace-pre-line text-zinc-700">{e.description}</p>}
                      {e.parts.length > 0 && (
                        <ul className="mt-1 text-[12px] text-zinc-700">
                          {e.parts.map((p, i) => (
                            <li key={i}>
                              • {p.qty && p.qty > 1 ? `${p.qty}× ` : ""}
                              {[p.brand, p.name].filter(Boolean).join(" ")}
                              {p.part_number && <span className="font-mono text-[11px] text-zinc-500"> #{p.part_number}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {[e.authorName && `${t.history.by} ${e.authorName}`, e.photoIds.length ? fill(t.history.photos, { n: e.photoIds.length }) : null].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">{e.cost != null ? formatMoney(Number(e.cost), e.currency, lang) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {sheet && Object.keys(sheet.settings).length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="text-base font-bold">{t.history.setup}</h2>
            <p className="mb-2 text-[11px] text-zinc-500">{fill(t.history.setupFrom, { title: sheet.title, date: formatDate(sheet.sheetDate, lang) })}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {TUNING_GROUPS.map((g) => {
                const fields = TUNING_FIELDS.filter((f) => f.group === g && sheet.settings[f.key]);
                if (!fields.length) return null;
                return (
                  <div key={g}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t.tuning.groups[g]}</h3>
                    {fields.map((f) => (
                      <p key={f.key} className="flex justify-between gap-2 border-b border-dotted border-zinc-200">
                        <span className="text-zinc-600">{hu ? f.hu : f.en}</span>
                        <span className="font-medium">
                          {sheet.settings[f.key]} {unitLabel(f.unit, lang)}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {schedule.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="mb-2 text-base font-bold">{t.history.schedule}</h2>
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {schedule.map((r) => (
                <li key={r.interval.id} className="flex justify-between gap-2 border-b border-dotted border-zinc-200 py-0.5">
                  <span>
                    {hu ? r.interval.labelHu : r.interval.labelEn} <span className="text-[11px] text-zinc-500">({intervalText(r.interval, t)})</span>
                  </span>
                  <span className={r.overdue ? "font-semibold text-red-700" : "text-zinc-700"}>{dueText(r, t)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t border-zinc-200 pt-2 text-[11px] text-zinc-400">{fill(t.history.generated, { date: formatDate(today, lang) })}</footer>
      </article>
    </div>
  );
}
