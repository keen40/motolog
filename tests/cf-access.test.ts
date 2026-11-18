import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { identityFromRequest } from "@/lib/auth";
import { clearAccessKeyCache, identityAliases, verifyAccessJwt, type AccessConfig } from "@/lib/cfAccess";

const TEAM = "myteam.cloudflareaccess.com";
const AUD = "aud-tag-123";
const HOST = "motolog.example.com";
const cfg: AccessConfig = { teamDomain: TEAM, aud: AUD, publicHost: HOST };

const good = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const evil = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...(good.publicKey.export({ format: "jwk" }) as crypto.JsonWebKey), kid: "k1", alg: "RS256" };

const b64 = (v: object | Buffer) => (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

function token(claims: Record<string, unknown> = {}, opts: { key?: crypto.KeyObject; kid?: string; alg?: string } = {}) {
  const header = b64({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1", typ: "JWT" });
  const payload = b64({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, iat: now(), email: "friend@gmail.com", ...claims });
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), opts.key ?? good.privateKey);
  return `${header}.${payload}.${b64(sig)}`;
}

const fetchKeys = async () => [jwk];

beforeEach(() => clearAccessKeyCache());

describe("Cloudflare Access token check", () => {
  it("accepts a valid token", async () => {
    expect(await verifyAccessJwt(token(), cfg, { fetchKeys })).toMatchObject({ email: "friend@gmail.com" });
  });

  it.each([
    ["no token", () => null],
    ["garbage", () => "not.a.jwt"],
    ["signed with another key", () => token({}, { key: evil.privateKey })],
    ["unknown key id", () => token({}, { kid: "nope" })],
    ["alg none", () => token({}, { alg: "none" })],
    ["another Access application", () => token({ aud: ["someone-else"] })],
    ["another team", () => token({ iss: "https://evil.cloudflareaccess.com" })],
    ["expired", () => token({ exp: now() - 3600 })],
    ["not valid yet", () => token({ nbf: now() + 3600 })],
    ["no e-mail", () => token({ email: undefined })],
  ])("rejects: %s", async (_, make) => {
    expect(await verifyAccessJwt(make(), cfg, { fetchKeys })).toBeNull();
  });

  it("rejects a token whose e-mail was edited after signing", async () => {
    const [h, , sig] = token().split(".");
    const forged = `${h}.${b64({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, email: "owner@gmail.com" })}.${sig}`;
    expect(await verifyAccessJwt(forged, cfg, { fetchKeys })).toBeNull();
  });

  it("parses identity aliases", () => {
    expect(identityAliases("Me@Gmail.com = keen40@github, x@y.hu=z@github").get("me@gmail.com")).toBe("keen40@github");
  });
});

describe("who is calling (tailnet + Cloudflare at the same time)", () => {
  const headers = (h: Record<string, string>) => {
    const m = new Map(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
    return { get: (k: string) => m.get(k.toLowerCase()) ?? null };
  };

  beforeAll(() => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM;
    process.env.CF_ACCESS_AUD = AUD;
    process.env.PUBLIC_HOST = HOST;
    process.env.IDENTITY_ALIASES = "me@gmail.com=keen40@github";
  });
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe(`https://${TEAM}/cdn-cgi/access/certs`);
        return Response.json({ keys: [jwk] });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => {
    for (const k of ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "PUBLIC_HOST", "IDENTITY_ALIASES"]) delete process.env[k];
  });

  it("identifies a public visitor by the verified token", async () => {
    const id = await identityFromRequest(headers({ host: HOST, "cf-access-jwt-assertion": token({ email: "Friend@Gmail.com" }) }), null, "tailscale");
    expect(id?.email).toBe("friend@gmail.com");
  });

  it("maps the owner's Cloudflare e-mail to their Tailscale login", async () => {
    const id = await identityFromRequest(headers({ host: HOST, "cf-access-jwt-assertion": token({ email: "me@gmail.com" }) }), null, "tailscale");
    expect(id?.email).toBe("keen40@github");
  });

  it("ignores forged Tailscale headers on the public address", async () => {
    expect(await identityFromRequest(headers({ host: HOST, "tailscale-user-login": "keen40@github" }), null, "tailscale")).toBeNull();
    const withBadToken = headers({ host: HOST, "tailscale-user-login": "keen40@github", "cf-access-jwt-assertion": token({}, { key: evil.privateKey }) });
    expect(await identityFromRequest(withBadToken, null, "tailscale")).toBeNull();
  });

  it("uses the verified token, not Tailscale headers, whenever a token is present", async () => {
    const h = headers({ host: "home-server.tail2736d3.ts.net:8451", "tailscale-user-login": "keen40@github", "cf-access-jwt-assertion": token({ email: "friend@gmail.com" }) });
    expect((await identityFromRequest(h, null, "tailscale"))?.email).toBe("friend@gmail.com");
  });

  it("keeps working as before on the tailnet address", async () => {
    const id = await identityFromRequest(headers({ host: "home-server.tail2736d3.ts.net:8451", "tailscale-user-login": "keen40@github", "tailscale-user-name": "=?utf-8?q?Kov=C3=A1cs?=" }), null, "tailscale");
    expect(id).toMatchObject({ email: "keen40@github", name: "Kovács" });
  });

  it("without Cloudflare configured, a Cloudflare header changes nothing", async () => {
    delete process.env.PUBLIC_HOST;
    const h = headers({ host: HOST, "tailscale-user-login": "keen40@github", "cf-access-jwt-assertion": "anything" });
    expect((await identityFromRequest(h, null, "tailscale"))?.email).toBe("keen40@github");
    process.env.PUBLIC_HOST = HOST;
  });
});
