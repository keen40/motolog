#!/usr/bin/env bash
# Deploy MotoLog: push the current branch to GitHub, then on the server pull it, rebuild and restart.
# Usage: scripts/deploy.sh        (from your dev machine, with a clean working tree)
set -euo pipefail

HOST="${DEPLOY_HOST:-home-server}"
DIR="${DEPLOY_DIR:-motolog}"          # relative to the server user's home
BRANCH="${DEPLOY_BRANCH:-main}"
PORT="${MOTOLOG_PORT:-3010}"

cd "$(dirname "$0")/.."

if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "You're on '$(git branch --show-current)', deploys go from '$BRANCH'. Merge first (or set DEPLOY_BRANCH)." >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Uncommitted changes – commit them first." >&2
  exit 1
fi

echo "→ pushing $BRANCH"
git push -q origin "$BRANCH"

echo "→ updating $HOST:~/$DIR and rebuilding"
ssh "$HOST" bash -se <<EOF
set -euo pipefail
cd ~/$DIR
git fetch -q origin
git checkout -q $BRANCH
git reset -q --hard origin/$BRANCH      # data/ and .env are git-ignored and untouched
docker compose up -d --build --quiet-pull 2>&1 | grep -vE '^\s*$' | tail -3
docker image prune -f >/dev/null
for i in \$(seq 1 20); do
  code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/no-access || true)
  [[ "\$code" == 200 ]] && { echo "✓ MotoLog is up (\$(git log -1 --format='%h %s'))"; exit 0; }
  sleep 1
done
echo "✗ MotoLog did not come up – check: docker logs motolog" >&2
exit 1
EOF
