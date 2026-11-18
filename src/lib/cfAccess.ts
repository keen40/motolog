import "server-only";
import crypto from "node:crypto";

/**
 * Cloudflare Access support. When the app is reached through a Cloudflare Tunnel protected by an
 * Access application, Cloudflare adds a signed JWT (Cf-Access-Jwt-Assertion) to every request.
 * We verify it ourselves – signature (RS256, Cloudflare's published keys), audience (the Access
 * application's AUD tag), issuer (your team domain) and expiry – and only then trust the e-mail in it.
 *
 * Config (all three required to enable):
 *   CF_ACCESS_TEAM_DOMAIN  e.g. "myteam.cloudflareaccess.com"
 *   CF_ACCESS_AUD          the Access application's "Application Audience (AUD) Tag"
 *   PUBLIC_HOST            e.g. "motolog.example.com" – requests for this host MUST carry a valid token
 */

export type AccessConfig = { teamDomain: string; aud: string; publicHost: string };

export function accessConfig(): AccessConfig | null {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const aud = process.env.CF_ACCESS_AUD?.trim();
  const publicHost = process.env.PUBLIC_HOST?.trim().toLowerCase();
  return teamDomain && aud && publicHost ? { teamDomain, aud, publicHost } : null;
}

type Jwk = crypto.JsonWebKey & { kid?: string };
type KeyFetcher = (teamDomain: string) => Promise<Jwk[]>;

const keyCache = new Map<string, { at: number; keys: Jwk[] }>();
const KEY_TTL = 60 * 60 * 1000;
const REFETCH_MIN = 60 * 1000;

const defaultFetchKeys: KeyFetcher = async (teamDomain) => {
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Access certs: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  return body.keys ?? [];
};

async function keysFor(teamDomain: string, kid: string, fetchKeys: KeyFetcher) {
  const hit = keyCache.get(teamDomain);
  const fresh = hit && Date.now() - hit.at < KEY_TTL;
  // Refetch when stale, or when the key isn't known yet (Cloudflare rotates keys) – but not more than once a minute.
  if (!hit || !fresh || (!hit.keys.some((k) => k.kid === kid) && Date.now() - hit.at > REFETCH_MIN)) {
    try {
      keyCache.set(teamDomain, { at: Date.now(), keys: await fetchKeys(teamDomain) });
    } catch (e) {
      if (!hit) throw e;
    }
  }
  return keyCache.get(teamDomain)!.keys;
}

const b64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export type AccessClaims = { email: string; sub?: string; name?: string };

/** Returns the verified claims, or null if the token is missing, malformed, forged, expired or for another app. */
export async function verifyAccessJwt(
  token: string | null | undefined,
  cfg: AccessConfig,
  opts: { fetchKeys?: KeyFetcher; now?: number } = {},
): Promise<AccessClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(b64url(parts[0]).toString("utf8")) as { alg?: string; kid?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const keys = await keysFor(cfg.teamDomain, header.kid, opts.fetchKeys ?? defaultFetchKeys);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const ok = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, b64url(parts[2]));
    if (!ok) return null;

    const claims = JSON.parse(b64url(parts[1]).toString("utf8")) as {
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
      email?: string;
      sub?: string;
      name?: string;
    };
    const now = Math.floor((opts.now ?? Date.now()) / 1000);
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!auds.includes(cfg.aud)) return null;
    if (claims.iss !== `https://${cfg.teamDomain}`) return null;
    if (!claims.exp || claims.exp < now - 30) return null;
    if (claims.nbf && claims.nbf > now + 30) return null;
    if (!claims.email) return null;
    return { email: claims.email, sub: claims.sub, name: claims.name };
  } catch {
    return null;
  }
}

/** For tests. */
export function clearAccessKeyCache() {
  keyCache.clear();
}

/**
 * "theirs@gmail.com=keen40@github, other@x.hu=other@github" → map from the e-mail someone signs in
 * with at Cloudflare to the identity they already have (e.g. their Tailscale login), so it's one account.
 */
export function identityAliases(raw = process.env.IDENTITY_ALIASES ?? "") {
  const map = new Map<string, string>();
  for (const pair of raw.split(/[,\n]/)) {
    const [from, to] = pair.split("=").map((s) => s?.trim().toLowerCase());
    if (from && to) map.set(from, to);
  }
  return map;
}
