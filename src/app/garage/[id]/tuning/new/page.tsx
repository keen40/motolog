import Link from "next/link";
import { TuningForm, type TuningFormValues } from "@/components/TuningForm";
import { requireVehicle } from "@/lib/access";
import { loadModel, loadTuningSheets } from "@/lib/data";
import { fill, getI18n } from "@/lib/i18n";

export default async function NewTuningSheetPage({ params, searchParams }: PageProps<"/garage/[id]/tuning/new">) {
  const { id } = await params;
  const sp = await searchParams;
  const { t } = await getI18n();
  const { vehicle } = await requireVehicle(id, "editor");
  const stock = loadModel(vehicle.modelId)?.stockSetup ?? null;
  const sheets = loadTuningSheets(id);

  // ?from=latest (default) | stock | blank | <sheet id>
  const from = typeof sp.from === "string" ? sp.from : "latest";
  const source = from === "latest" ? sheets[0] : sheets.find((s) => s.id === from);
  const mode = source ? (from === "latest" ? "latest" : "copy") : from === "stock" && stock ? "stock" : from === "blank" || !stock ? "blank" : "stock";

  const today = new Date().toISOString().slice(0, 10);
  const initial: TuningFormValues = {
    title: "",
    sheetDate: today,
    engineHours: vehicle.engineHours,
    track: source?.track ?? null,
    surface: source?.surface ?? null,
    weather: null,
    tempC: null,
    altitudeM: source?.altitudeM ?? null,
    settings: source ? { ...source.settings } : mode === "stock" && stock ? { ...stock.values } : {},
    rating: null,
    notes: null,
  };

  const option = (key: string, label: string, active: boolean) => (
    <Link
      key={key}
      href={`/garage/${id}/tuning/new?from=${key}`}
      replace
      className={`chip ${active ? "bg-accent text-black" : "bg-surface-2 text-muted hover:text-foreground"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/garage/${id}?tab=tuning`} className="text-sm text-muted hover:text-foreground">
        ← {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="text-2xl font-bold">{t.tuning.newSheet}</h1>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{t.tuning.startFrom}:</span>
        {sheets.length > 0 && option("latest", t.tuning.startLatest, mode === "latest")}
        {stock && option("stock", t.tuning.startStock, mode === "stock")}
        {option("blank", t.tuning.startBlank, mode === "blank")}
        {mode === "copy" && source && <span className="chip bg-accent text-black">{fill(t.tuning.copyOf, { title: source.title })}</span>}
      </div>
      {/* key forces a fresh form when switching the starting point */}
      <TuningForm key={from} vehicleId={id} sheetId={null} initial={initial} stock={stock} />
    </div>
  );
}
