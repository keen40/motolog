import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, PHOTO_DIR, schema as s } from "@/db";

// Request context and Next helpers, replaced by plain values the tests control.
let reqHeaders = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => reqHeaders.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("REDIRECT"), { to });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const auth = await import("@/lib/auth");
const { saveProfile, inviteGuest, removeGuest } = await import("@/app/profile/actions");
const { addGuestEmail, removeGuestEmail } = await import("@/lib/cfApi");

const db = () => getDb();
const run = async (p: Promise<unknown>) => {
  try {
    return await p;
  } catch (e) {
    if ((e as Error).message !== "REDIRECT") throw e;
  }
};
const form = (data: Record<string, string | string[] | File>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};
const asTailscale = (login: string, name?: string) => {
  reqHeaders = new Map([["host", "home-server.ts.net:8451"], ["tailscale-user-login", login], ...(name ? [["tailscale-user-name", name] as [string, string]] : [])]);
};
const userBy = (email: string) => db().select().from(s.users).where(eq(s.users.email, email)).get()!;

beforeAll(() => {
  process.env.AUTH_MODE = "tailscale";
});

describe("profile", () => {
  it("lets the provider's name fill in only until the user saves their own", async () => {
    asTailscale("owner@github", "Tailscale Name");
    const first = await auth.getCurrentUser();
    expect(first?.name).toBe("Tailscale Name");
    expect(first?.profileDone).toBe(false);

    await run(saveProfile(form({ name: "Balázs", lang: "hu" })));
    expect(userBy("owner@github")).toMatchObject({ name: "Balázs", profileDone: true });

    asTailscale("owner@github", "Changed In Tailscale");
    expect((await auth.getCurrentUser())?.name).toBe("Balázs");
  });

  it("stores an uploaded picture, replaces the old one and can remove it", async () => {
    asTailscale("owner@github");
    const jpg = () => new File([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], "me.jpg", { type: "image/jpeg" });
    await run(saveProfile(form({ name: "Balázs", avatar: jpg() })));
    const one = userBy("owner@github").avatarFile!;
    expect(fs.existsSync(path.join(PHOTO_DIR, "avatars", one))).toBe(true);
    expect(auth.avatarSrc(userBy("owner@github"))).toContain(`/avatars/${userBy("owner@github").id}`);

    await run(saveProfile(form({ name: "Balázs", avatar: jpg() })));
    const two = userBy("owner@github").avatarFile!;
    expect(two).not.toBe(one);
    expect(fs.existsSync(path.join(PHOTO_DIR, "avatars", one))).toBe(false);

    await run(saveProfile(form({ name: "Balázs", remove_avatar: "1" })));
    expect(userBy("owner@github").avatarFile).toBeNull();
    expect(fs.existsSync(path.join(PHOTO_DIR, "avatars", two))).toBe(false);
  });
});

describe("admins", () => {
  afterEach(() => delete process.env.MOTOLOG_ADMINS);

  it("is the first user by default, or whoever MOTOLOG_ADMINS names", async () => {
    asTailscale("friend@github");
    const friend = (await auth.getCurrentUser())!;
    const owner = userBy("owner@github");
    expect(auth.isAdmin(owner)).toBe(true);
    expect(auth.isAdmin(friend)).toBe(false);
    process.env.MOTOLOG_ADMINS = "friend@github";
    expect(auth.isAdmin(friend)).toBe(true);
    expect(auth.isAdmin(owner)).toBe(false);
  });
});

/** A fake Cloudflare API holding one policy. */
function fakeCloudflare(initialInclude: object[]) {
  const policy: Record<string, unknown> = {
    id: "pol-1",
    uid: "pol-1",
    name: "Family & friends",
    decision: "allow",
    include: initialInclude,
    exclude: [],
    require: [],
    session_duration: "730h",
    created_at: "2026-11-18",
    updated_at: "2026-11-18",
    reusable: true,
    app_count: 1,
  };
  const puts: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc-1/access/policies/pol-1");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer cf-token");
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        puts.push(body);
        Object.assign(policy, body);
      }
      return Response.json({ success: true, result: policy, errors: [] });
    }),
  );
  return { policy, puts };
}

describe("Cloudflare guest list", () => {
  beforeEach(() => {
    process.env.CF_API_TOKEN = "cf-token";
    process.env.CF_ACCOUNT_ID = "acc-1";
    process.env.CF_ACCESS_POLICY_ID = "pol-1";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adds an e-mail and keeps every other rule and setting", async () => {
    const cf = fakeCloudflare([{ email: { email: "me@gmail.com" } }, { group: { id: "grp-1" } }]);
    await addGuestEmail("New@Friend.hu");
    expect(cf.puts).toHaveLength(1);
    const body = cf.puts[0];
    expect(body.include).toEqual([{ group: { id: "grp-1" } }, { email: { email: "me@gmail.com" } }, { email: { email: "new@friend.hu" } }]);
    expect(body).toMatchObject({ name: "Family & friends", decision: "allow", session_duration: "730h" });
    for (const k of ["id", "uid", "created_at", "updated_at", "reusable", "app_count"]) expect(body).not.toHaveProperty(k);
  });

  it("doesn't write when nothing changes, and refuses to empty the list", async () => {
    const cf = fakeCloudflare([{ email: { email: "me@gmail.com" } }]);
    await addGuestEmail("me@gmail.com");
    await removeGuestEmail("nobody@x.hu");
    expect(cf.puts).toHaveLength(0);
    await expect(removeGuestEmail("me@gmail.com")).rejects.toThrow(/lock everyone out/);
  });

  it("invites: admin only, valid e-mails, shares only the admin's own bikes", async () => {
    const cf = fakeCloudflare([{ email: { email: "me@gmail.com" } }]);
    const owner = userBy("owner@github");
    const friend = userBy("friend@github");
    const mine = db().insert(s.vehicles).values({ ownerId: owner.id, make: "Yamaha", model: "YZ125", year: 2001 }).returning().get();
    const theirs = db().insert(s.vehicles).values({ ownerId: friend.id, make: "KTM", model: "125 SX", year: 2015 }).returning().get();

    asTailscale("friend@github");
    await expect(inviteGuest({}, form({ email: "x@y.hu" }))).rejects.toThrow(/Only admins/);

    asTailscale("owner@github");
    expect(await inviteGuest({}, form({ email: "not-an-email" }))).toEqual({ errorKey: "invalidEmail" });

    const res = await inviteGuest({}, form({ email: "Pal@Gmail.com", share_bike: [mine.id, theirs.id], role: "editor" }));
    expect(res).toEqual({ ok: "pal@gmail.com" });
    expect(cf.policy.include).toContainEqual({ email: { email: "pal@gmail.com" } });
    expect(db().select().from(s.invites).where(eq(s.invites.email, "pal@gmail.com")).get()).toBeTruthy();
    const shares = db().select().from(s.vehicleShares).where(eq(s.vehicleShares.email, "pal@gmail.com")).all();
    expect(shares.map((x) => [x.vehicleId, x.role])).toEqual([[mine.id, "editor"]]);

    // Removing takes them off the list and takes back the shares; the admin can't remove themself.
    process.env.IDENTITY_ALIASES = "me@gmail.com=owner@github";
    expect(await removeGuest("me@gmail.com")).toEqual({ errorKey: "cantRemoveSelf" });
    expect(await removeGuest("pal@gmail.com")).toEqual({});
    expect(cf.policy.include).toEqual([{ email: { email: "me@gmail.com" } }]);
    expect(db().select().from(s.vehicleShares).where(eq(s.vehicleShares.email, "pal@gmail.com")).all()).toHaveLength(0);
    expect(db().select().from(s.invites).where(eq(s.invites.email, "pal@gmail.com")).get()).toBeUndefined();
    delete process.env.IDENTITY_ALIASES;
  });

  it("reports a Cloudflare error instead of pretending it worked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false, errors: [{ message: "Authentication error" }] }, { status: 403 })));
    asTailscale("owner@github");
    const res = await inviteGuest({}, form({ email: "late@x.hu" }));
    expect(res.error).toMatch(/403.*Authentication error/);
    expect(db().select().from(s.invites).where(eq(s.invites.email, "late@x.hu")).get()).toBeUndefined();
  });
});
