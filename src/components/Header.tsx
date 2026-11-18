import Link from "next/link";
import { setLang, switchDevUser } from "@/app/actions";
import { authMode, DEV_USERS, getCurrentUser } from "@/lib/auth";
import { LOGO_AMBER, LOGO_PATHS, LOGO_SHIFT } from "@/lib/logo";
import { Avatar } from "./Avatar";
import { getI18n } from "@/lib/i18n";

export async function Header() {
  const { lang, t } = await getI18n();
  const user = await getCurrentUser();
  const dev = authMode() === "dev";

  return (
    <header className="sticky top-0 z-30 print:hidden border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-4">
        <Link href="/garage" className="flex shrink-0 items-center gap-2 font-semibold">
          <Logo />
          <span>{t.app.name}</span>
        </Link>
        <Link href="/catalogue" className="min-w-0 truncate text-sm text-muted hover:text-foreground">
          {t.catalogue.nav}
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
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
                  → <span className="hidden sm:inline">{e.split("@")[0]}</span>
                  <span className="sm:hidden">{e.slice(0, 1)}</span>
                </button>
              ))}
            </form>
          )}
          {user && (
            <Link href="/profile" className="flex items-center gap-2 text-sm" title={`${t.profile.open} · ${user.email}`} aria-label={t.profile.open}>
              <Avatar user={user} size={28} />
              <span className="hidden text-muted sm:inline">{user.name ?? user.email}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill={LOGO_AMBER} />
      <g transform={`translate(${LOGO_SHIFT.x} ${LOGO_SHIFT.y})`}>
        {LOGO_PATHS.map((p, i) => (
          <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}
