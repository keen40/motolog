import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRide } from "@/app/garage/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RideForm } from "@/components/RideForm";
import { requireVehicle } from "@/lib/access";
import { loadRides, loadTuningSheets } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export default async function EditRidePage({ params }: PageProps<"/garage/[id]/ride/[rideId]">) {
  const { id, rideId } = await params;
  const { t } = await getI18n();
  const { vehicle } = await requireVehicle(id, "editor");
  const ride = loadRides(id).find((r) => r.id === rideId);
  if (!ride) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/garage/${id}?tab=rides`} className="text-sm text-muted hover:text-foreground">
        ← {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="text-2xl font-bold">{t.rides.edit}</h1>
      <RideForm vehicleId={id} rideId={ride.id} engineHours={vehicle.engineHours} sheets={loadTuningSheets(id)} initial={ride} />
      <form action={deleteRide.bind(null, id, ride.id)} className="flex justify-end">
        <ConfirmButton message={t.rides.deleteConfirm} className="btn-danger text-xs">
          {t.rides.delete}
        </ConfirmButton>
      </form>
    </div>
  );
}
