import Link from "next/link";
import { setLang, switchDevUser } from "@/app/actions";
import { authMode, DEV_USERS, getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";

export async function Header() {
  const { lang, t } = await getI18n();
  const user = await getCurrentUser();
  const dev = authMode() === "dev";

  return (
    <header className="sticky top-0 z-30 print:hidden border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/garage" className="flex items-center gap-2 font-semibold">
          <Logo />
          <span>{t.app.name}</span>
        </Link>
        <Link href="/catalogue" className="text-sm text-muted hover:text-foreground">
          {t.catalogue.nav}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <form action={setLang} className="flex rounded-lg border border-border p-0.5 text-xs">
            {(["hu", "en"] as const).map((l) => (
              <button
                key={l}
                name="lang"
                value={l}
                className={`rounded-md px-2 py-1 uppercase ${l === lang ? "bg-surface-2 text-foreground" : "text-muted"}`}
              >
                {l}
              </button>
            ))}
          </form>
          {dev && user && (
            <form action={switchDevUser} className="flex items-center gap-1 text-xs">
              <span className="chip bg-amber-900/40 text-amber-300">dev</span>
              {DEV_USERS.filter((e) => e !== user.email).map((e) => (
                <button key={e} name="email" value={e} className="text-muted hover:text-foreground" title="Switch test user">
                  → {e.split("@")[0]}
                </button>
              ))}
            </form>
          )}
          {user && (
            <span className="flex items-center gap-2 text-sm" title={user.email}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold uppercase">
                  {(user.name ?? user.email).slice(0, 1)}
                </span>
              )}
              <span className="hidden text-muted sm:inline">{user.name ?? user.email}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <circle cx="10" cy="20" r="5" fill="none" stroke="#000" strokeWidth="2.2" />
      <circle cx="23" cy="20" r="5" fill="none" stroke="#000" strokeWidth="2.2" />
      <path d="M10 20 L15 12 L21 12 L23 20 M15 12 L13 9" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
