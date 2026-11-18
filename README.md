# MotoLog

A personal, self-hosted log for your motorcycles: every service, modification, repair and planned upgrade, with an
interactive bike map, build timeline, cost and service stats, a plan board, model specs, compatible parts and
shops that ship to Hungary. Share bikes with family and friends (view-only or edit).

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · SQLite (better-sqlite3 + Drizzle) · Recharts.
Runs as one Docker container behind the host's `tailscale serve`. No login screen: Tailscale tells the app who you are.
UI in Hungarian and English.

## Run on the server (Docker + host Tailscale)

First-time setup on the server:

```bash
git clone git@github.com:keen40/motolog.git ~/motolog && cd ~/motolog
mkdir -p data                                        # owned by your user (uid 1000, same as the container)
docker compose up -d --build
sudo tailscale serve --bg --https=8451 http://127.0.0.1:3010
```

Open `https://home-server.<tailnet>.ts.net:8451` from any device on your tailnet.

Everyone who can reach it over the tailnet gets their own garage. To share a bike, open it → **Sharing** →
enter their Tailscale login (e-mail) → *Can view* or *Can edit*.

### Phone

Open the URL in Safari (iPhone) or Chrome (Android) and use **Share → Add to Home Screen** / **Install app**.
It opens full-screen like an app. Photos are shrunk to ~2048px JPEG in the browser before upload
(iPhone HEIC photos included).

### Deploying changes

From your dev machine, on `main` with everything committed:

```bash
scripts/deploy.sh
```

It first runs the type check, linter and tests (and stops if any fail), then pushes to GitHub,
and on the server pulls, rebuilds, restarts and checks the app is up.
(Override with `DEPLOY_HOST`, `DEPLOY_DIR`, `DEPLOY_BRANCH`; `SKIP_CHECKS=1` only in an emergency.)

### Tests

```bash
npm test
```

Vitest, in `tests/`. Each test file gets its own throwaway database (the real `./data` is never touched)
and OpenAI is replaced by a fake, so tests are free and offline. They cover the parts that could
silently damage data: re-seeding vs. rider corrections, AI lookup merging and source filtering,
ride hours, access rules, the service schedule and tuning comparisons.

### Why it's safe without a login

The container is published on `127.0.0.1:3010` only, so the only way in is `tailscale serve`, which adds the
`Tailscale-User-Login` / `-Name` / `-Profile-Pic` headers. **Don't** publish the port on `0.0.0.0` or enable Funnel:
anyone who can reach the app directly could fake those headers. The optional Cloudflare tunnel (below) is the
one other way in, and there the app accepts only a verified Cloudflare Access token.

### Access without the tailnet (Cloudflare Tunnel + Access)

For family and friends who aren't on the tailnet. `cloudflared` opens an **outbound** tunnel to Cloudflare –
no ports are opened on the server – and Cloudflare Access asks every visitor for their e-mail and a one-time
code before anything reaches MotoLog. Only e-mails on your guest list get a code. The app then **verifies
Access's signed token itself** (signature, audience, team, expiry), and on the public address it ignores any
Tailscale headers, so it can't be spoofed. The tailnet address keeps working as before.

One-time setup in the Cloudflare dashboard (Zero Trust):

1. **Networks → Tunnels → Create a tunnel → Cloudflared**, name it `motolog`. Copy the token from the shown
   install command (the long string after `--token`). Don't run their install command – Docker runs it.
2. In the tunnel, **Public hostname → Add**: subdomain `motolog`, your domain, service type **HTTP**, URL **`app:3000`**.
3. **Access → Applications → Add → Self-hosted**: application domain `motolog.<your domain>`, session e.g. 1 month.
   Policy: action **Allow**, include **Emails** → your guest list (yourself too). Login method: **One-time PIN**.
   Save, then copy the **Application Audience (AUD) Tag**. Your team domain is `<team>.cloudflareaccess.com`
   (Settings → Custom pages / Team name).
4. *(For installing it on phones)* add a second self-hosted application on the same domain with paths
   `manifest.webmanifest`, `pwa-icon/*` and `icon.svg`, policy action **Bypass**, include **Everyone**.
   Phones fetch these without cookies; they contain no data.

Then on the server, add to `~/motolog/.env` and start it:

```
COMPOSE_PROFILES=public
CLOUDFLARE_TUNNEL_TOKEN=eyJ...
PUBLIC_HOST=motolog.example.com
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=...
IDENTITY_ALIASES=you@gmail.com=keen40@github     # your Cloudflare e-mail → your existing account
```

```bash
cd ~/motolog && docker compose up -d
```

**Invites:** admins (`MOTOLOG_ADMINS`, or by default the first person who used the app) get a **People**
section on their profile page: invite an e-mail, optionally share bikes with it, send the link, or remove
someone. With the Cloudflare API connected, this edits the Access policy's e-mail list directly
(read-modify-write; other rules are kept; it refuses to empty the list). Without it, invites are only noted
in the app and you add the e-mail in the dashboard yourself. To connect it, add to `.env`:

```
CF_API_TOKEN=...          # My Profile → API Tokens → Create → Custom: Account · Access: Apps and Policies · Edit
CF_ACCOUNT_ID=...
CF_ACCESS_POLICY_ID=...   # the reusable "Family & friends" policy
```

### Switching to Authentik later

Put the app behind an Authentik proxy outpost (forward auth) and set `AUTH_MODE=header`. The app reads
`X-authentik-email` / `X-authentik-name` (configurable via `AUTH_EMAIL_HEADER` / `AUTH_NAME_HEADER`). Users are matched
by e-mail, so keep the same e-mail as the Tailscale login if you want to keep existing garages.

### Backups

`scripts/backup.sh` writes a consistent SQLite snapshot plus all photos to
`/mnt/data/backups/motolog/motolog-<date>.tar.gz` and keeps 14 days (`BACKUP_DIR`, `KEEP_DAYS` to change).
It runs nightly from cron:

```cron
15 3 * * * $HOME/motolog/scripts/backup.sh >> /mnt/data/backups/motolog/backup.log 2>&1
```

Restore:

```bash
cd ~/motolog && docker compose stop
mkdir -p /tmp/restore && tar -xzf /mnt/data/backups/motolog/motolog-<date>.tar.gz -C /tmp/restore
rm -f data/motolog.db-wal data/motolog.db-shm
cp /tmp/restore/backup-snapshot.db data/motolog.db && rsync -a --delete /tmp/restore/photos/ data/photos/
docker compose start
```

An older backup is fine: the app applies any missing database upgrades when it starts.

**Restore drill** – proves the newest backup really restores, without touching the live app
(throwaway container on 127.0.0.1:3099, checks integrity, row counts vs. live, photo files, and that the
garage renders; cleans up after itself):

```bash
~/motolog/scripts/restore-test.sh                 # newest backup
~/motolog/scripts/restore-test.sh <archive.tar.gz> # a specific one
```

It also runs automatically at 03:45 on the 1st of every month (right after that night's backup), logging to
`/mnt/data/backups/motolog/backup.log` – look for `RESTORE TEST PASSED` / `FAILED`:

```
45 3 1 * * $HOME/motolog/scripts/restore-test.sh >> /mnt/data/backups/motolog/backup.log 2>&1
```

## Develop locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. In dev mode you're `me@dev.local`; the **dev** switch in the header lets you become
`friend@dev.local` to test sharing. Data goes to `./data`.

After changing `src/db/schema.ts`, create a migration with `npx drizzle-kit generate`.

## How the reference data works

| Data | Source |
| --- | --- |
| Yamaha YZ125 2001 | Checked by hand against Yamaha's owner's service manual (`src/db/seed.ts`, page cited on every value). |
| Other models | **AI lookup** (Catalogue → *Look up a model*): one OpenAI call with web search fills specs, service intervals, parts and the stock setup. Stored as an *AI draft – unverified* with a source link per value; everyone reuses it. |
| Corrections | Anyone can confirm or correct a value. Corrections are never overwritten by a re-seed or a new AI lookup. |
| Shops | Search-link templates (`{q}` → query) for shops that ship to Hungary. No APIs, no scraping. |

### AI lookups

Add to `~/motolog/.env` on the server, then `docker compose up -d`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-6-luna      # optional
AI_MONTHLY_LOOKUPS=20        # optional hard cap per month
```

- Make, model, displacement and year are required; the market (Europe/USA) matters for jetting and gearing.
- A lookup for a model that already has checked data (like the YZ125) is **not** written into the catalogue –
  its page shows the AI result next to the existing values. That's how to judge the AI's accuracy.
- Cost on `gpt-6-luna`: roughly $0.10–0.15 per lookup (mostly the $0.01 web searches). The catalogue page shows
  this month's count and estimated cost.

## Layout

```
Dockerfile, docker-compose.yml   deployment
scripts/            deploy.sh (from your PC), backup.sh (nightly on the server)
drizzle/            SQL migrations (generated)
src/db/             schema, connection (auto-migrate + seed), reference data
src/lib/auth.ts     identity from Tailscale / SSO headers (or dev user)
src/lib/access.ts   owner / editor / viewer checks
src/app/            pages, server actions, /photos/[id] (access-checked images)
src/components/     BikeDiagram, Timeline, PlanBoard, StatsCharts, SpecsPanel, PartsFinder, SharePanel, ...
```
