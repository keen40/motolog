#!/usr/bin/env bash
# Nightly MotoLog backup: a consistent SQLite snapshot + all photos in one tar.gz, keeping KEEP_DAYS days.
# Runs on the server (cron). Restore: see README "Backups".
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/motolog}"
DEST="${BACKUP_DIR:-/mnt/data/backups/motolog}"
KEEP_DAYS="${KEEP_DAYS:-14}"
CONTAINER="${CONTAINER:-motolog}"

stamp="$(date +%F_%H%M)"
log() { echo "$(date '+%F %T') $*"; }

if [[ ! -d "$DEST" || ! -w "$DEST" ]]; then
  log "ERROR: backup folder $DEST is missing or not writable" >&2
  exit 1
fi

# Snapshot the live database through SQLite's online backup API (safe while the app is writing).
docker exec "$CONTAINER" node -e '
  const Database = require("better-sqlite3");
  const db = new Database("/data/motolog.db", { readonly: true });
  db.backup("/data/backup-snapshot.db").then(() => db.close()).catch((e) => { console.error(e); process.exit(1); });
'
trap 'rm -f "$APP_DIR/data/backup-snapshot.db" "$DEST/motolog-$stamp.tar.gz.part"' EXIT

tar -czf "$DEST/motolog-$stamp.tar.gz.part" -C "$APP_DIR/data" backup-snapshot.db photos
mv "$DEST/motolog-$stamp.tar.gz.part" "$DEST/motolog-$stamp.tar.gz"

find "$DEST" -maxdepth 1 -name 'motolog-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
log "OK $(du -h "$DEST/motolog-$stamp.tar.gz" | cut -f1) → $DEST/motolog-$stamp.tar.gz"
