import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listGarage, type GarageVehicle } from "@/lib/data";
import { fill, getI18n } from "@/lib/i18n";
import { photoUrl } from "@/lib/photos";
import { formatMoney } from "@/lib/zones";

export default async function GaragePage() {
  const { lang, t } = await getI18n();
  const user = await requireUser();
  // First time here: say hello and ask for a name and picture.
  if (!user.profileDone) redirect("/profile?welcome=1");
  const vehicles = listGarage(user);
  const mine = vehicles.filter((v) => v.role === "owner");
  const shared = vehicles.filter((v) => v.role !== "owner");

  const Card = ({ v }: { v: GarageVehicle }) => (
    <Link href={`/garage/${v.id}`} className="card group overflow-hidden transition-colors hover:border-accent">
      <div className="flex aspect-[16/9] items-center justify-center bg-surface-2">
        {v.photoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl(v.photoId)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl opacity-40">🏍️</span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          {v.year} · {v.make}
          {v.ownerName && <span className="normal-case"> · {fill(t.share.sharedBy, { name: v.ownerName })}</span>}
        </p>
        <h2 className="text-lg font-semibold group-hover:text-accent">
          {v.model}
          {v.nickname && <span className="font-normal text-muted"> “{v.nickname}”</span>}
        </h2>
        <p className="text-sm text-muted">
          {v.engineHours != null && `${v.engineHours} ${t.garage.hours} · `}
          {v.doneCount} {t.garage.events}
          {v.spent.map((x) => ` · ${formatMoney(x.total, x.currency, lang)}`).join("")}
        </p>
      </div>
    </Link>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.garage.title}</h1>
        <Link href="/garage/new" className="btn-primary">
          + {t.garage.add}
        </Link>
      </div>

      {mine.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-muted">{t.garage.empty}</p>
          <Link href="/garage/new" className="btn-primary">
            + {t.garage.add}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((v) => (
            <Card key={v.id} v={v} />
          ))}
        </div>
      )}

      {shared.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t.garage.shared}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((v) => (
              <Card key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
