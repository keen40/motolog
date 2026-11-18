import { shareVehicle, unshareVehicle } from "@/app/garage/actions";
import { getI18n } from "@/lib/i18n";
import { SubmitButton } from "./SubmitButton";

type Props = {
  vehicleId: string;
  shares: { email: string; role: "viewer" | "editor"; name: string | null }[];
  knownUsers: { email: string; name: string | null }[];
};

export async function SharePanel({ vehicleId, shares, knownUsers }: Props) {
  const { t } = await getI18n();
  return (
    <div className="card p-4">
      <h2 className="font-semibold">👥 {t.share.title}</h2>
      <p className="mb-3 text-xs text-muted">{t.share.hint}</p>

      {shares.length === 0 ? (
        <p className="mb-3 text-sm text-muted">{t.share.none}</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded-xl bg-surface-2">
          {shares.map((sh) => (
            <li key={sh.email} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {sh.name && <span className="font-medium">{sh.name} </span>}
                <span className="text-muted">{sh.email}</span>
              </span>
              <span className="chip bg-surface text-muted">{sh.role === "editor" ? t.share.editor : t.share.viewer}</span>
              <form action={unshareVehicle.bind(null, vehicleId, sh.email)}>
                <button className="text-xs text-muted hover:text-red-400">{t.share.remove}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={shareVehicle.bind(null, vehicleId)} className="flex flex-wrap gap-2">
        <input name="email" type="text" required list="known-users" placeholder={t.share.email} className="input min-w-56 flex-1" autoComplete="off" />
        <datalist id="known-users">
          {knownUsers.map((u) => (
            <option key={u.email} value={u.email}>
              {u.name ?? ""}
            </option>
          ))}
        </datalist>
        <select name="role" className="input w-auto" aria-label={t.share.title}>
          <option value="viewer">{t.share.viewer}</option>
          <option value="editor">{t.share.editor}</option>
        </select>
        <SubmitButton className="btn-ghost">{t.share.add}</SubmitButton>
      </form>
    </div>
  );
}
