import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { retryLookup } from "@/app/catalogue/actions";
import { getDb, schema as s } from "@/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StatusChip } from "@/components/StatusChip";
import { SubmitButton } from "@/components/SubmitButton";
import { expireStaleLookup, type LookupResult } from "@/lib/ai/lookup";
import { requireUser } from "@/lib/auth";
import { loadIntervals, loadModel, loadParts, loadSpecs } from "@/lib/data";
import { fill, getI18n } from "@/lib/i18n";
import { TUNING_FIELDS } from "@/lib/tuning";

type Row = { key: string; label: string; current?: string | null; ai?: string | null; source?: string | null };

function hostname(u: string | null | undefined) {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function SourceLink({ url }: { url: string | null | undefined }) {
  const h = hostname(url);
  if (!h || !url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className="text-[11px] text-accent hover:underline">
      {h}
    </a>
  );
}

export default async function LookupPage({ params }: PageProps<"/catalogue/lookups/[id]">) {
  await requireUser();
  const { id } = await params;
  const { t, lang } = await getI18n();
  const db = getDb();
  let lookup = db.select().from(s.aiLookups).where(eq(s.aiLookups.id, id)).get();
  if (!lookup) notFound();
  if (expireStaleLookup(lookup)) lookup = db.select().from(s.aiLookups).where(eq(s.aiLookups.id, id)).get()!;

  const { input, status } = lookup;
  const result = lookup.result as LookupResult | null;
  const model = loadModel(lookup.modelId);
  const compare = !lookup.apply && !!model;
  const hu = lang === "hu";
  const statusLabel = t.catalogue.status[status as keyof typeof t.catalogue.status] ?? status;

  // Build comparison rows (existing data vs AI result).
  let specRows: Row[] = [];
  let stockRows: Row[] = [];
  let intervalRows: Row[] = [];
  if (result && model) {
    const current = compare ? loadSpecs(model.id) : [];
    const keys = [...new Set([...current.map((x) => x.seedKey ?? x.id), ...result.specs.map((x) => x.key)])];
    specRows = keys.map((k) => {
      const c = current.find((x) => (x.seedKey ?? x.id) === k);
      const a = result.specs.find((x) => x.key === k);
      return { key: k, label: (hu ? (c?.labelHu ?? a?.label_hu) : (c?.labelEn ?? a?.label_en)) ?? k, current: c?.value, ai: a?.value, source: a?.source_url };
    });

    const stock = compare ? model.stockSetup?.values ?? {} : {};
    stockRows = TUNING_FIELDS.filter((f) => stock[f.key] || result.stock_setup.some((x) => x.key === f.key)).map((f) => {
      const a = result.stock_setup.find((x) => x.key === f.key);
      return { key: f.key, label: `${t.tuning.groups[f.group]} · ${hu ? f.hu : f.en}`, current: stock[f.key], ai: a?.value, source: a?.source_url };
    });

    const every = (h: number | null | undefined, m: number | null | undefined) => [h != null ? `${h} h` : null, m != null ? fill(t.stats.months, { n: m }) : null].filter(Boolean).join(" / ");
    const currentIntervals = compare ? loadIntervals(model.id) : [];
    const tasks = [...new Set([...currentIntervals.map((x) => x.taskKey), ...result.intervals.map((x) => x.task_key)])];
    intervalRows = tasks.map((k) => {
      const c = currentIntervals.find((x) => x.taskKey === k);
      const a = result.intervals.find((x) => x.task_key === k);
      return {
        key: k,
        label: (hu ? (c?.labelHu ?? a?.label_hu) : (c?.labelEn ?? a?.label_en)) ?? k,
        current: c ? every(c.intervalHours, c.intervalMonths) : null,
        ai: a ? every(a.hours, a.months) : null,
        source: a?.source_url,
      };
    });
  }
  const currentParts = compare && model ? loadParts(model.id) : [];

  const table = (title: string, rows: Row[]) =>
    rows.length ? (
      <div className="card overflow-hidden">
        <h2 className="p-4 font-semibold">{title}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2"> </th>
                {compare && <th className="px-3 py-2">{t.catalogue.existing}</th>}
                <th className="px-3 py-2">{t.catalogue.ai}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border align-top">
                  <td className="w-40 px-3 py-2 text-muted">{r.label}</td>
                  {compare && <td className="px-3 py-2">{r.current ?? <span className="text-xs text-muted">{t.catalogue.onlyAi}</span>}</td>}
                  <td className="px-3 py-2">
                    {r.ai ?? <span className="text-xs text-red-300/80">{t.catalogue.missing}</span>}
                    {r.ai && (
                      <div>
                        <SourceLink url={r.source} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {(status === "queued" || status === "running") && <AutoRefresh seconds={5} />}
      <Link href="/catalogue" className="text-sm text-muted hover:text-foreground">
        ← {t.catalogue.title}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {input.year} {model?.make ?? input.make} {model?.model ?? input.model}
          </h1>
          <p className="text-sm text-muted">
            {input.engineCc} cc{input.stroke ? ` · ${input.stroke}T` : ""}
            {input.category ? ` · ${input.category}` : ""} · {input.market}
          </p>
          {lookup.inputTokens != null && (
            <p className="mt-1 text-xs text-muted">
              {fill(t.catalogue.cost, {
                tokens: ((lookup.inputTokens ?? 0) + (lookup.outputTokens ?? 0)).toLocaleString(),
                searches: lookup.searchCalls ?? 0,
                cost: (lookup.costUsd ?? 0).toFixed(3),
                model: lookup.aiModel ?? "",
              })}
            </p>
          )}
        </div>
        <StatusChip status={status} label={statusLabel} />
      </div>

      {(status === "queued" || status === "running") && (
        <div className="card flex items-center gap-3 p-4 text-sm text-muted">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          {t.catalogue.running}
        </div>
      )}

      {status === "failed" && (
        <div className="card space-y-3 p-4 text-sm">
          <p>
            <span className="text-red-300">{t.catalogue.failed}</span> <span className="text-muted">{lookup.error}</span>
          </p>
          <form action={retryLookup.bind(null, lookup.id)}>
            <SubmitButton className="btn-ghost">{t.catalogue.retry}</SubmitButton>
          </form>
        </div>
      )}

      {status === "done" && result && (
        <>
          <div className="card space-y-2 p-4 text-sm">
            <p>
              <span className="text-muted">{t.catalogue.identified}:</span> <span className="font-medium">{result.identified.official_name}</span>
              {result.identified.model_code && <span className="text-muted"> ({result.identified.model_code})</span>}
            </p>
            {!result.identified.matches_request && (
              <p className="text-amber-300">
                ⚠ {t.catalogue.mismatch} {result.identified.note}
              </p>
            )}
            <p className="text-muted">{hu ? result.summary_hu : result.summary_en}</p>
            {compare ? (
              <p className="rounded-xl bg-surface-2 p-3 text-xs">{t.catalogue.compareNote}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-emerald-300">✓ {t.catalogue.done}</span>
                {model && (
                  <Link href={`/garage/new?model=${model.id}`} className="btn-primary">
                    {t.catalogue.addBike}
                  </Link>
                )}
              </div>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="card p-4 text-sm">
              <h2 className="mb-2 font-semibold">⚠ {t.catalogue.warnings}</h2>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {table(t.catalogue.specs, specRows)}
          {table(t.catalogue.stockSetup, stockRows)}
          {table(t.catalogue.intervals, intervalRows)}

          <div className="card overflow-hidden">
            <h2 className="p-4 font-semibold">{t.catalogue.parts}</h2>
            <ul className="divide-y divide-border border-t border-border text-sm">
              {result.parts.map((p, i) => {
                const same = currentParts.find((c) => c.partNumber && p.part_number && c.partNumber.replace(/\W/g, "").toLowerCase() === p.part_number.replace(/\W/g, "").toLowerCase());
                return (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                    <span>
                      <span className="text-muted">{p.category}:</span> {p.brand} {p.name}
                      {p.part_number && <span className="font-mono text-xs"> #{p.part_number}</span>}
                      {same && <span className="ml-1 text-xs text-emerald-300">✓</span>}
                    </span>
                    <SourceLink url={p.source_url} />
                  </li>
                );
              })}
            </ul>
            {compare && currentParts.some((p) => p.partNumber) && (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                {t.catalogue.existing}: {currentParts.filter((p) => p.partNumber).map((p) => `${p.brand} ${p.partNumber}`).join(" · ")}
              </p>
            )}
          </div>

          {(lookup.sources?.length ?? 0) > 0 && (
            <details className="card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                {t.catalogue.sources} ({lookup.sources!.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {lookup.sources!.slice(0, 40).map((u) => (
                  <li key={u} className="truncate">
                    <a href={u} target="_blank" rel="noreferrer noopener" className="text-xs text-accent hover:underline">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
