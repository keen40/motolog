import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema as s } from "@/db";
import { LookupForm } from "@/components/LookupForm";
import { StatusChip } from "@/components/StatusChip";
import { aiConfig, lookupsThisMonth } from "@/lib/ai/lookup";
import { requireUser } from "@/lib/auth";
import { fill, getI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/zones";

export default async function CataloguePage() {
  await requireUser();
  const { t, lang } = await getI18n();
  const db = getDb();
  const cfg = aiConfig();
  const usage = lookupsThisMonth();

  const models = db
    .select({
      id: s.vehicleModels.id,
      make: s.vehicleModels.make,
      model: s.vehicleModels.model,
      yearFrom: s.vehicleModels.yearFrom,
      yearTo: s.vehicleModels.yearTo,
      engineCc: s.vehicleModels.engineCc,
      dataOrigin: s.vehicleModels.dataOrigin,
      specs: sql<number>`(select count(*) from "model_specs" ms where ms."model_id" = "vehicle_models"."id")`,
      // Models without data stay hidden unless a lookup is in progress or a bike uses them (failed lookups / typos).
      pending: sql<number>`(select count(*) from "ai_lookups" l where l."model_id" = "vehicle_models"."id" and l."status" in ('queued', 'running'))`,
      bikes: sql<number>`(select count(*) from "vehicles" v where v."model_id" = "vehicle_models"."id")`,
    })
    .from(s.vehicleModels)
    .orderBy(s.vehicleModels.make, s.vehicleModels.model, s.vehicleModels.yearFrom)
    .all()
    .filter((m) => m.specs > 0 || m.pending > 0 || m.bikes > 0);
  const lookups = db
    .select({ l: s.aiLookups, by: s.users.name })
    .from(s.aiLookups)
    .leftJoin(s.users, eq(s.users.id, s.aiLookups.userId))
    .orderBy(desc(s.aiLookups.createdAt))
    .limit(10)
    .all();

  const disabled = !cfg.apiKey ? "noKey" : usage.count >= cfg.monthlyLimit ? "limit" : null;
  const statusLabel = (st: string) => t.catalogue.status[st as keyof typeof t.catalogue.status] ?? st;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.catalogue.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t.catalogue.intro}</p>
        <p className="mt-2 text-xs text-muted">
          {fill(t.catalogue.usage, { n: usage.count, max: cfg.monthlyLimit, cost: usage.costUsd.toFixed(2) })} · {cfg.model}
        </p>
      </div>

      <LookupForm disabled={disabled} />

      <div className="card overflow-hidden">
        <h2 className="p-4 font-semibold">{t.catalogue.models}</h2>
        <ul className="divide-y divide-border border-t border-border">
          {models.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">
                  {m.make} {m.model}
                </span>{" "}
                <span className="text-muted">
                  {m.yearFrom === m.yearTo ? m.yearFrom : `${m.yearFrom}–${m.yearTo}`}
                  {m.engineCc ? ` · ${m.engineCc} cc` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {!m.specs ? (
                  <span className="chip bg-surface-2 text-muted">{t.catalogue.noData}</span>
                ) : m.dataOrigin === "ai" ? (
                  <span className="chip bg-violet-950/60 text-violet-300">{t.catalogue.aiDraft}</span>
                ) : (
                  <span className="chip bg-emerald-950/60 text-emerald-300">{t.catalogue.verified}</span>
                )}
                {m.specs > 0 && (
                  <Link href={`/garage/new?model=${m.id}`} className="text-xs text-accent hover:underline">
                    + {t.garage.add}
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {lookups.length > 0 && (
        <div className="card overflow-hidden">
          <h2 className="p-4 font-semibold">{t.catalogue.recent}</h2>
          <ul className="divide-y divide-border border-t border-border">
            {lookups.map(({ l, by }) => (
              <li key={l.id}>
                <Link href={`/catalogue/lookups/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-2">
                  <span>
                    {l.input.year} {l.input.make} {l.input.model}{" "}
                    <span className="text-xs text-muted">
                      · {formatDate(l.createdAt.replace(" ", "T") + "Z", lang)}
                      {by ? ` · ${by}` : ""}
                      {l.costUsd != null ? ` · ≈ $${l.costUsd.toFixed(2)}` : ""}
                    </span>
                  </span>
                  <StatusChip status={l.status} label={statusLabel(l.status)} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
