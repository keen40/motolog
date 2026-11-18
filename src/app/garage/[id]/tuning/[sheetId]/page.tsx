import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTuningSheet } from "@/app/garage/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TuningForm } from "@/components/TuningForm";
import { requireVehicle } from "@/lib/access";
import { loadModel, loadTuningSheets } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export default async function EditTuningSheetPage({ params }: PageProps<"/garage/[id]/tuning/[sheetId]">) {
  const { id, sheetId } = await params;
  const { t } = await getI18n();
  const { vehicle } = await requireVehicle(id, "editor");
  const sheet = loadTuningSheets(id).find((s) => s.id === sheetId);
  if (!sheet) notFound();
  const stock = loadModel(vehicle.modelId)?.stockSetup ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/garage/${id}?tab=tuning`} className="text-sm text-muted hover:text-foreground">
        ← {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="text-2xl font-bold">{t.tuning.editSheet}</h1>
      <TuningForm vehicleId={id} sheetId={sheet.id} initial={sheet} stock={stock} />
      <form action={deleteTuningSheet.bind(null, id, sheet.id)} className="flex justify-end">
        <ConfirmButton message={t.tuning.deleteConfirm} className="btn-danger text-xs">
          {t.tuning.delete}
        </ConfirmButton>
      </form>
    </div>
  );
}
