import Link from "next/link";
import { EventForm } from "@/components/EventForm";
import { requireVehicle } from "@/lib/access";
import { loadIntervals } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import type { EventKind, ZoneId } from "@/lib/types";
import { ZONES } from "@/lib/zones";

export default async function NewEventPage({ params, searchParams }: PageProps<"/garage/[id]/log">) {
  const { id } = await params;
  const sp = await searchParams;
  const { t } = await getI18n();
  const { vehicle } = await requireVehicle(id, "editor");

  const kind: EventKind = ["service", "mod", "repair", "plan"].includes(sp.kind as string) ? (sp.kind as EventKind) : "service";
  const zone: ZoneId = ZONES.includes(sp.zone as ZoneId) ? (sp.zone as ZoneId) : "other";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/garage/${id}`} className="text-sm text-muted hover:text-foreground">
        ← {vehicle.year} {vehicle.make} {vehicle.model}
      </Link>
      <h1 className="text-2xl font-bold">{t.event.newTitle}</h1>
      <EventForm
        vehicleId={id}
        event={null}
        defaults={{ kind, zone, engine_hours: vehicle.engineHours, odometer_km: vehicle.odometerKm }}
        intervals={loadIntervals(vehicle.modelId)}
        photos={{}}
      />
    </div>
  );
}
