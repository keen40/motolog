#!/usr/bin/env bash
# Restore drill: proves the newest backup can actually be restored, without touching the live app.
# Unpacks it into a temp folder, starts a throwaway MotoLog container on it (loopback only),
# checks the database, that the app serves the garage, and that the data matches the live counts.
# Runs on the server:  ~/motolog/scripts/restore-test.sh   (or pass a specific archive path)
set -euo pipefail

DEST="${BACKUP_DIR:-/mnt/data/backups/motolog}"
IMAGE="${IMAGE:-motolog:latest}"
LIVE="${CONTAINER:-motolog}"
NAME="motolog-restore-test"
PORT="${RESTORE_TEST_PORT:-3099}"

archive="${1:-$(ls -1t "$DEST"/motolog-*.tar.gz 2>/dev/null | head -1)}"
[[ -f "$archive" ]] || { echo "✗ no backup archive found in $DEST" >&2; exit 1; }

tmp="$(mktemp -d)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

echo "$(date '+%F %T') restore drill: $(basename "$archive") ($(du -h "$archive" | cut -f1))"
tar -xzf "$archive" -C "$tmp"
mv "$tmp/backup-snapshot.db" "$tmp/motolog.db"
mkdir -p "$tmp/photos"

# Counts we compare between the restored copy and the live app.
COUNT_JS='
  const D = require("better-sqlite3");
  const db = new D(process.argv[1], { readonly: true });
  const n = (t) => db.prepare(`select count(*) n from ${t}`).get().n;
  const out = { integrity: db.prepare("pragma integrity_check").get().integrity_check };
  out.users = db.prepare("select count(*) n from users where email != ?").get("restore-test@localhost").n;
  for (const t of ["vehicles", "vehicle_events", "tuning_sheets", "rides", "vehicle_models", "model_specs", "photos"]) out[t] = n(t);
  const owner = db.prepare("select u.email from vehicles v join users u on u.id = v.owner_id limit 1").get();
  out.ownerEmail = owner ? owner.email : null;
  out.bike = (db.prepare("select model from vehicles limit 1").get() || {}).model || null;
  console.log(JSON.stringify(out));
'

# Start the restored app. Opening a page runs any database upgrades the backup predates,
# exactly as a real restore would – so an older backup must come up on the current code.
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" -e HOSTNAME=0.0.0.0 -e AUTH_MODE=tailscale -v "$tmp":/data "$IMAGE" >/dev/null
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/no-access" || true)"
  [[ "$code" == 200 ]] && break
  sleep 1
done
[[ "$code" == 200 ]] || { echo "✗ restored app did not start"; docker logs "$NAME" | tail -20; exit 1; }
curl -s -o /dev/null -H "Tailscale-User-Login: restore-test@localhost" "http://127.0.0.1:$PORT/garage" || true

restored="$(docker exec -w /app "$NAME" node -e "$COUNT_JS" /data/motolog.db)"
live="$(docker exec -w /app "$LIVE" node -e "$COUNT_JS" /data/motolog.db)"

ok=1
get() { jq -r --arg k "$2" '.[$k] // empty' <<<"$1"; }   # the server has jq; node only exists inside the containers

[[ "$(get "$restored" integrity)" == "ok" ]] && echo "✓ database integrity: ok" || { echo "✗ database integrity: $(get "$restored" integrity)"; ok=0; }

for t in users vehicles vehicle_events tuning_sheets rides vehicle_models model_specs photos; do
  r="$(get "$restored" "$t")"; l="$(get "$live" "$t")"
  if [[ "$r" == "$l" ]]; then echo "✓ $t: $r"; else echo "• $t: backup $r, live $l (changed since the backup?)"; fi
done

files_backup="$(find "$tmp/photos" -type f | wc -l)"
files_rows="$(get "$restored" photos)"
[[ "$files_backup" == "$files_rows" ]] && echo "✓ photo files: $files_backup" || { echo "✗ photo files: $files_backup on disk, $files_rows in the database"; ok=0; }

# The restored app must start and render the owner's garage.
email="$(get "$restored" ownerEmail)"; bike="$(get "$restored" bike)"
if [[ -n "$email" ]]; then
  page="$(curl -s -H "Tailscale-User-Login: $email" "http://127.0.0.1:$PORT/garage")"
  if grep -q "$bike" <<<"$page"; then echo "✓ restored app shows the garage ($bike)"; else echo "✗ restored app did not show the garage"; ok=0; fi
else
  [[ "$code" == 200 ]] && echo "✓ restored app is up (no bikes to show)" || { echo "✗ restored app did not start"; ok=0; }
fi

if [[ $ok == 1 ]]; then echo "✓ RESTORE TEST PASSED"; else echo "✗ RESTORE TEST FAILED" >&2; exit 1; fi
