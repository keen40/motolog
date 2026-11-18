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

It pushes to GitHub, then on the server pulls, rebuilds, restarts and checks the app is up.
(Override with `DEPLOY_HOST`, `DEPLOY_DIR`, `DEPLOY_BRANCH`.)

### Why it's safe without a login

The container is published on `127.0.0.1:3010` only, so the only way in is `tailscale serve`, which adds the
`Tailscale-User-Login` / `-Name` / `-Profile-Pic` headers. **Don't** publish the port on `0.0.0.0` or enable Funnel:
anyone who can reach the app directly could fake those headers.

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
