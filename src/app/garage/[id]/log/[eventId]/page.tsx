import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEvent } from "@/app/garage/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EventForm } from "@/components/EventForm";
import { requireVehicle } from "@/lib/access";
import { loadEvent, loadIntervals } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { photoUrl } from "@/lib/photos";

export default async function EditEventPage({ params }: PageProps<"/garage/[id]/log/[eventId]">) {
  const { id, eventId } = await params;
  const { t } = await getI18n();
  const { vehicle } = await requireVehicle(id, "editor");
  const event = loadEvent(id, eventId);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/garage/${id}`} className="text-sm text-muted hover:text-foreground">
        ← {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="text-2xl font-bold">{t.event.editTitle}</h1>
      <EventForm
        vehicleId={id}
        event={event}
        defaults={{ kind: event.kind, zone: event.zone, engine_hours: vehicle.engineHours, odometer_km: vehicle.odometerKm }}
        intervals={loadIntervals(vehicle.modelId)}
        photos={Object.fromEntries(event.photoIds.map((p) => [p, photoUrl(p)]))}
      />
      <form action={deleteEvent.bind(null, id, eventId)} className="flex justify-end">
        <ConfirmButton message={t.event.deleteConfirm} className="btn-danger text-xs">
          {t.event.delete}
        </ConfirmButton>
      </form>
    </div>
  );
}
