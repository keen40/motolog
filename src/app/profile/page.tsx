import { asc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { Avatar } from "@/components/Avatar";
import { InviteForm, RemoveGuest } from "@/components/PeopleForms";
import { PhotoInput } from "@/components/PhotoInput";
import { SubmitButton } from "@/components/SubmitButton";
import { isAdmin, requireUser } from "@/lib/auth";
import { identityAliases } from "@/lib/cfAccess";
import { cfApiConfig, getGuestPolicy } from "@/lib/cfApi";
import { fill, getI18n } from "@/lib/i18n";
import { saveProfile, skipProfile } from "./actions";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const sp = await searchParams;
  const user = await requireUser();
  const { t, lang } = await getI18n();
  const welcome = sp.welcome !== undefined || !user.profileDone;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{welcome ? t.profile.welcome : t.profile.title}</h1>
        {welcome && <p className="mt-1 text-sm text-muted">{t.profile.welcomeHint}</p>}
      </div>

      <form action={saveProfile} className="card space-y-5 p-4 sm:p-6">
        {welcome && <input type="hidden" name="welcome" value="1" />}
        <div className="flex items-center gap-4">
          <Avatar user={user} size={72} />
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="avatar">
              {t.profile.photo}
            </label>
            <PhotoInput name="avatar" id="avatar" square />
            {user.avatarFile && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="remove_avatar" value="1" className="accent-amber-500" /> {t.profile.removePhoto}
              </label>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              {t.profile.name}
            </label>
            <input id="name" name="name" required maxLength={60} defaultValue={user.name ?? ""} placeholder={t.profile.namePh} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="lang">
              {t.profile.language}
            </label>
            <select id="lang" name="lang" defaultValue={lang} className="input">
              <option value="hu">Magyar</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">
          {t.profile.login}: <span className="font-mono text-foreground">{user.email}</span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sp.saved !== undefined && <span className="mr-auto text-sm text-emerald-300">✓ {t.profile.saved}</span>}
          {welcome && (
            <button formAction={skipProfile} formNoValidate className="btn-ghost">
              {t.profile.skip}
            </button>
          )}
          <SubmitButton>{t.profile.save}</SubmitButton>
        </div>
      </form>

      {!welcome && isAdmin(user) && <PeopleSection userId={user.id} ownEmail={user.email} />}
    </div>
  );
}

async function PeopleSection({ userId, ownEmail }: { userId: string; ownEmail: string }) {
  const { t } = await getI18n();
  const db = getDb();
  const aliases = identityAliases();
  const publicHost = process.env.PUBLIC_HOST?.trim();
  const publicUrl = publicHost ? `https://${publicHost}` : null;

  let policy: Awaited<ReturnType<typeof getGuestPolicy>> | null = null;
  let policyError: string | null = null;
  if (cfApiConfig()) {
    try {
      policy = await getGuestPolicy();
    } catch (e) {
      policyError = e instanceof Error ? e.message : String(e);
    }
  }

  const invited = db.select().from(s.invites).orderBy(asc(s.invites.createdAt)).all();
  const emails = [...new Set([...(policy?.emails ?? []), ...invited.map((i) => i.email)])];
  const identities = emails.map((e) => aliases.get(e) ?? e);
  const users = identities.length ? db.select().from(s.users).where(inArray(s.users.email, identities)).all() : [];
  const bikes = db
    .select({ id: s.vehicles.id, make: s.vehicles.make, model: s.vehicles.model, nickname: s.vehicles.nickname })
    .from(s.vehicles)
    .where(eq(s.vehicles.ownerId, userId))
    .all()
    .map((b) => ({ id: b.id, label: b.nickname ? `${b.model} “${b.nickname}”` : `${b.make} ${b.model}` }));

  return (
    <section className="card space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">👥 {t.people.title}</h2>
        <p className="mt-1 text-xs text-muted">{fill(t.people.hint, { url: publicUrl ?? "—" })}</p>
      </div>
      {!cfApiConfig() && <p className="rounded-xl bg-amber-950/40 px-3 py-2 text-xs text-amber-200">{t.people.noApi}</p>}
      {policyError && <p className="rounded-xl bg-red-950/40 px-3 py-2 text-xs text-red-300">{fill(t.people.error, { message: policyError })}</p>}
      {policy?.hasOtherRules && <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{t.people.otherRules}</p>}

      <InviteForm bikes={bikes} publicUrl={publicUrl} />

      {emails.length > 0 && (
        <ul className="divide-y divide-border rounded-xl bg-surface-2">
          {emails.map((e) => {
            const identity = aliases.get(e) ?? e;
            const u = users.find((x) => x.email === identity);
            const self = identity === ownEmail;
            return (
              <li key={e} className="flex items-center gap-3 px-3 py-2">
                {u ? <Avatar user={u} size={32} /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm">✉️</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u?.name ?? e}</p>
                  <p className="truncate text-xs text-muted">
                    {u?.name ? `${e} · ` : ""}
                    {self ? t.people.you : u ? t.people.joined : t.people.pending}
                  </p>
                </div>
                {!self && <RemoveGuest email={e} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
