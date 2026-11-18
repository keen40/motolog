import { addSpec, toggleSpecVerification, updateSpecValue } from "@/app/garage/actions";
import { fill, getI18n } from "@/lib/i18n";
import type { FitmentPart, ModelSpec, Shop, VehicleModel, ZoneId } from "@/lib/types";
import { PartsFinder } from "./PartsFinder";
import { SubmitButton } from "./SubmitButton";

const GROUPS = ["engine", "fuel", "ignition", "drivetrain", "chassis", "suspension", "brakes", "wheels", "fluids", "dimensions"];
const GROUP_ICONS: Record<string, string> = {
  engine: "⚙️",
  fuel: "⛽",
  ignition: "⚡",
  drivetrain: "⛓️",
  chassis: "🔩",
  suspension: "🪝",
  brakes: "🛑",
  wheels: "🛞",
  fluids: "🛢️",
  dimensions: "📏",
};

type Props = {
  vehicleId: string;
  model: VehicleModel;
  specs: ModelSpec[];
  parts: FitmentPart[];
  shops: Shop[];
  userId: string;
  zone: ZoneId | null;
};

export async function SpecsPanel({ vehicleId, model, specs, parts, shops, userId, zone }: Props) {
  const { t, lang } = await getI18n();
  const grouped = GROUPS.map((g) => [g, specs.filter((s) => s.specGroup === g)] as const).filter(([, list]) => list.length);
  const bikeName = `${model.make} ${model.model}`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <div className="card p-4">
          <h2 className="mb-1 font-semibold">{t.specs.title}</h2>
          {model.dataOrigin === "ai" && (
            <p className="mb-2 rounded-xl bg-violet-950/40 px-3 py-2 text-xs text-violet-200">🤖 {t.specs.aiNote}</p>
          )}
          <p className="mb-4 text-xs text-muted">{t.specs.seedNote}</p>
          <div className="space-y-4">
            {grouped.map(([group, list]) => (
              <div key={group}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {GROUP_ICONS[group]} {group}
                </h3>
                <dl className="divide-y divide-border rounded-xl bg-surface-2">
                  {list.map((s) => {
                    const n = s.verifiedBy.length;
                    const mine = s.verifiedBy.includes(userId);
                    return (
                      <div key={s.id} className="flex items-start gap-3 px-3 py-2">
                        <dt className="w-32 shrink-0 text-xs text-muted">{lang === "hu" ? s.labelHu : s.labelEn}</dt>
                        <dd className="min-w-0 flex-1 text-sm">
                          {s.value}
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                            <span className={n ? "text-emerald-400" : "text-amber-400/80"}>
                              {n ? `✓ ${fill(t.specs.verified, { n })}` : `⚠ ${t.specs.unverified}`}
                            </span>
                            {s.source && <SourceText source={s.source} />}
                          </div>
                        </dd>
                        <div className="flex flex-col items-end gap-1">
                          <form action={toggleSpecVerification.bind(null, vehicleId, s.id, mine)}>
                            <button className={`rounded-md px-2 py-0.5 text-[11px] ${mine ? "text-muted hover:text-foreground" : "bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/70"}`}>
                              {mine ? t.specs.unverify : t.specs.verify}
                            </button>
                          </form>
                          <details className="text-right">
                            <summary className="cursor-pointer list-none text-[11px] text-muted hover:text-foreground">✎</summary>
                            <form action={updateSpecValue.bind(null, vehicleId, s.id)} className="mt-1 flex w-56 flex-col gap-1">
                              <input name="value" required defaultValue={s.value} className="input py-1 text-xs" aria-label={t.specs.value} />
                              <input name="source" placeholder={t.specs.source} className="input py-1 text-xs" />
                              <SubmitButton className="btn-ghost py-1 text-xs">{t.specs.edit}</SubmitButton>
                            </form>
                          </details>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-accent">+ {t.specs.addSpec}</summary>
            <form action={addSpec.bind(null, vehicleId, model.id)} className="mt-3 grid gap-2">
              <select name="spec_group" className="input" aria-label={t.specs.group}>
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <input name="label" required placeholder={t.specs.label} className="input" />
              <input name="value" required placeholder={t.specs.value} className="input" />
              <input name="source" placeholder={t.specs.source} className="input" />
              <SubmitButton className="btn-ghost">{t.specs.save}</SubmitButton>
            </form>
          </details>
        </div>

        <div className="card p-4">
          <h2 className="mb-2 font-semibold">{t.specs.links}</h2>
          <ul className="space-y-2 text-sm">
            {model.partsCatalogUrl && (
              <li>
                <a href={model.partsCatalogUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  📘 {t.specs.partsCatalog} ↗
                </a>
              </li>
            )}
            {model.ownersManualUrl && (
              <li>
                <a href={model.ownersManualUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  📖 {t.specs.ownersManual} ↗
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-3">
        <PartsFinder vehicleId={vehicleId} modelId={model.id} bikeName={bikeName} parts={parts} shops={shops} initialZone={zone} />
      </div>
    </div>
  );
}

/** "AI · https://site/page" → "AI · site" as a link; plain text otherwise. */
function SourceText({ source }: { source: string }) {
  const m = source.match(/https?:\/\/\S+/);
  if (!m) return <span className="text-muted">· {source}</span>;
  let host = m[0];
  try {
    host = new URL(m[0]).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <span className="text-muted">
      · {source.slice(0, m.index).trim()}{" "}
      <a href={m[0]} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
        {host}
      </a>
    </span>
  );
}
