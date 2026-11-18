import Link from "next/link";
import { updateVehicle } from "@/app/garage/actions";
import { BikeForm } from "@/components/BikeForm";
import { requireVehicle } from "@/lib/access";
import { listModels } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { photoUrl } from "@/lib/photos";

export default async function EditBikePage({ params }: PageProps<"/garage/[id]/edit">) {
  const { id } = await params;
  const { t } = await getI18n();
  const { vehicle: v } = await requireVehicle(id, "editor");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/garage/${id}`} className="text-sm text-muted hover:text-foreground">
        ← {v.year} {v.make} {v.model}
      </Link>
      <h1 className="text-2xl font-bold">{t.bike.edit}</h1>
      <BikeForm
        models={listModels()}
        action={updateVehicle.bind(null, id)}
        initial={{
          modelId: v.modelId,
          make: v.make,
          model: v.model,
          year: v.year,
          nickname: v.nickname,
          vin: v.vin,
          engineHours: v.engineHours,
          odometerKm: v.odometerKm,
          purchaseDate: v.purchaseDate,
          notes: v.notes,
          photoUrl: v.photoId ? photoUrl(v.photoId) : null,
        }}
      />
    </div>
  );
}
