import "server-only";

/**
 * Edits the guest list = the e-mail rules of one reusable Cloudflare Access policy ("Family & friends").
 *
 *   CF_API_TOKEN          API token with only "Access: Apps and Policies – Edit" on the account
 *   CF_ACCOUNT_ID         the Cloudflare account id
 *   CF_ACCESS_POLICY_ID   the policy's id
 *
 * Always read-modify-write: we fetch the whole policy, change only its `include` e-mail rules and send
 * everything else back as it was, so other rules (groups, require/exclude, session settings) survive.
 */

const API = "https://api.cloudflare.com/client/v4";

export type CfApiConfig = { token: string; accountId: string; policyId: string };

export function cfApiConfig(): CfApiConfig | null {
  const token = process.env.CF_API_TOKEN?.trim();
  const accountId = process.env.CF_ACCOUNT_ID?.trim();
  const policyId = process.env.CF_ACCESS_POLICY_ID?.trim();
  return token && accountId && policyId ? { token, accountId, policyId } : null;
}

type Rule = Record<string, unknown> & { email?: { email: string } };
type Policy = Record<string, unknown> & { include?: Rule[]; name?: string };

/** Fields the API returns but doesn't accept back. */
const READ_ONLY = ["id", "uid", "created_at", "updated_at", "app_count", "reusable", "precedence", "connection_rules_count"];

async function call<T>(cfg: CfApiConfig, method: "GET" | "PUT", body?: unknown): Promise<T> {
  const res = await fetch(`${API}/accounts/${cfg.accountId}/access/policies/${cfg.policyId}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { message: string }[] } | null;
  if (!res.ok || !json?.success) {
    throw new Error(`Cloudflare ${method} policy failed (${res.status}): ${json?.errors?.map((e) => e.message).join("; ") || res.statusText}`);
  }
  return json.result as T;
}

export const ruleEmail = (r: Rule) => (r.email?.email ?? "").trim().toLowerCase();

export async function getGuestPolicy(cfg = cfApiConfig()) {
  if (!cfg) throw new Error("Cloudflare API is not configured");
  const policy = await call<Policy>(cfg, "GET");
  const include = policy.include ?? [];
  return {
    name: policy.name ?? "",
    emails: include.map(ruleEmail).filter(Boolean),
    /** True if the policy also lets in everyone / whole domains / groups – then the list isn't the whole story. */
    hasOtherRules: include.some((r) => !r.email),
  };
}

async function editEmails(change: (emails: string[]) => string[], cfg = cfApiConfig()) {
  if (!cfg) throw new Error("Cloudflare API is not configured");
  const policy = await call<Policy>(cfg, "GET");
  const include = policy.include ?? [];
  const others = include.filter((r) => !r.email);
  const before = include.map(ruleEmail).filter(Boolean);
  const after = [...new Set(change(before).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (after.length === before.length && after.every((e) => before.includes(e))) return after; // nothing to do
  if (!after.length && !others.length) throw new Error("Refusing to empty the guest list – that would lock everyone out");
  const body: Policy = { ...policy, include: [...others, ...after.map((email) => ({ email: { email } }))] };
  for (const k of READ_ONLY) delete body[k];
  await call(cfg, "PUT", body);
  return after;
}

export function addGuestEmail(email: string, cfg = cfApiConfig()) {
  return editEmails((list) => [...list, email], cfg);
}

export function removeGuestEmail(email: string, cfg = cfApiConfig()) {
  const e = email.trim().toLowerCase();
  return editEmails((list) => list.filter((x) => x !== e), cfg);
}
