import "server-only";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { accessConfig, identityAliases, verifyAccessJwt } from "./cfAccess";

/**
 * Who is using the app. There is no login screen: identity comes from whatever sits in front of the app.
 *
 *  AUTH_MODE=tailscale (default in production)
 *      `tailscale serve` adds Tailscale-User-Login / -Name / -Profile-Pic headers for tailnet users.
 *  AUTH_MODE=header
 *      A forward-auth proxy (e.g. Authentik) sets AUTH_EMAIL_HEADER (default X-authentik-email)
 *      and AUTH_NAME_HEADER (default X-authentik-name).
 *  AUTH_MODE=dev (default in `npm run dev`)
 *      Uses DEV_USER_EMAIL, switchable with the "dev_user" cookie to test sharing locally.
 *
 * Optionally, at the same time: Cloudflare Access (see lib/cfAccess.ts) for people outside the tailnet.
 * Requests for PUBLIC_HOST, or carrying a Cf-Access-Jwt-Assertion, are identified ONLY by that verified
 * token – Tailscale/SSO headers on that route are ignored, since anyone on the internet could send them.
 *
 * SECURITY: in tailscale/header mode the app trusts these headers, so it must only be reachable through
 * that proxy or the Cloudflare tunnel (never publish its port on the LAN or internet). docker-compose ensures this.
 */
export type AuthMode = "tailscale" | "header" | "dev";

export function authMode(): AuthMode {
  const m = process.env.AUTH_MODE;
  if (m === "tailscale" || m === "header" || m === "dev") return m;
  return process.env.NODE_ENV === "production" ? "tailscale" : "dev";
}

export const DEV_USERS = ["me@dev.local", "friend@dev.local"];

type Identity = { email: string; name: string | null; avatarUrl: string | null };

/** Tailscale sends non-ASCII names as RFC 2047 encoded-words, e.g. =?utf-8?q?Kov=C3=A1cs?= */
export function decodeHeaderValue(value: string | null): string | null {
  if (!value) return value;
  return value.replace(/=\?([^?]+)\?([qQbB])\?([^?]*)\?=/g, (whole, charset: string, enc: string, text: string) => {
    try {
      const bytes =
        enc.toLowerCase() === "b"
          ? Buffer.from(text, "base64")
          : Buffer.from(
              text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))),
              "latin1",
            );
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return whole;
    }
  });
}

type HeaderGetter = { get(name: string): string | null };

/** Works out who is calling from the request headers (and the dev cookie). Exported for tests. */
export async function identityFromRequest(h: HeaderGetter, devCookie: string | null, mode: AuthMode = authMode()): Promise<Identity | null> {
  if (mode !== "dev") {
    const cf = accessConfig();
    if (cf) {
      const token = h.get("cf-access-jwt-assertion");
      const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
      if (token || host === cf.publicHost) {
        const claims = await verifyAccessJwt(token, cf);
        if (!claims) return null;
        const email = claims.email.trim().toLowerCase();
        return { email: identityAliases().get(email) ?? email, name: null, avatarUrl: null };
      }
    }
  }
  if (mode === "tailscale") {
    const login = h.get("tailscale-user-login");
    if (!login) return null;
    return { email: login, name: decodeHeaderValue(h.get("tailscale-user-name")), avatarUrl: h.get("tailscale-user-profile-pic") };
  }
  if (mode === "header") {
    const email = h.get(process.env.AUTH_EMAIL_HEADER ?? "x-authentik-email");
    if (!email) return null;
    return { email, name: decodeHeaderValue(h.get(process.env.AUTH_NAME_HEADER ?? "x-authentik-name")), avatarUrl: null };
  }
  const devEmail = devCookie ?? process.env.DEV_USER_EMAIL ?? DEV_USERS[0];
  return { email: devEmail, name: devEmail.split("@")[0], avatarUrl: null };
}

async function readIdentity(): Promise<Identity | null> {
  return identityFromRequest(await headers(), (await cookies()).get("dev_user")?.value ?? null);
}

export type User = typeof schema.users.$inferSelect;

/** Current user (created on first visit), or null when no identity header is present. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const id = await readIdentity();
  if (!id) return null;
  const email = id.email.trim().toLowerCase();
  const db = getDb();
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    if ((id.name && id.name !== existing.name) || (id.avatarUrl && id.avatarUrl !== existing.avatarUrl)) {
      return db
        .update(schema.users)
        .set({ name: id.name ?? existing.name, avatarUrl: id.avatarUrl ?? existing.avatarUrl })
        .where(eq(schema.users.id, existing.id))
        .returning()
        .get();
    }
    return existing;
  }
  return db.insert(schema.users).values({ email, name: id.name, avatarUrl: id.avatarUrl }).returning().get();
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/no-access");
  return user;
}
