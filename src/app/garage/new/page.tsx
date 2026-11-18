import { NewBikeForm } from "@/components/NewBikeForm";
import { requireUser } from "@/lib/auth";
import { listModels } from "@/lib/data";
import { getI18n } from "@/lib/i18n";

export default async function NewBikePage() {
  const { t } = await getI18n();
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t.newBike.title}</h1>
      <NewBikeForm models={listModels()} />
    </div>
  );
}
