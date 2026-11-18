import Link from "next/link";
import { RideForm } from "@/components/RideForm";
import { requireVehicle } from "@/lib/access";
import { loadRides, loadTuningSheets } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export default async function NewRidePage({ params }: PageProps<"/garage/[id]/ride">) {
  const { id } = await params;
  const { t } = await getI18n();
  const { vehicle } = await requireVehicle(id, "editor");
  const sheets = loadTuningSheets(id);
  const last = loadRides(id)[0];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/garage/${id}?tab=rides`} className="text-sm text-muted hover:text-foreground">
        ← {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="text-2xl font-bold">🏁 {t.rides.add}</h1>
      <RideForm
        vehicleId={id}
        rideId={null}
        engineHours={vehicle.engineHours}
        sheets={sheets}
        // Same place and setup as last time is the common case.
        initial={{
          rideDate: new Date().toISOString().slice(0, 10),
          durationH: null,
          track: last?.track ?? null,
          surface: last?.surface ?? null,
          tuningSheetId: sheets[0]?.id ?? null,
          fuelL: null,
          notes: null,
        }}
      />
    </div>
  );
}
