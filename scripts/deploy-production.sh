#!/usr/bin/env bash
# Atomic production deploy for owl-web Docker container on 127.0.0.1:3100
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DOCKER_HOST="${DOCKER_HOST:-tcp://127.0.0.1:2375}"

RELEASE="${1:-$(date -u +%Y%m%d-%H%M%S)}"
BACKUP_DIR="releases/backup-pre-${RELEASE}"
mkdir -p releases "$BACKUP_DIR"

echo "[deploy] release=$RELEASE"
OLD_BUNDLE=$(curl -s http://127.0.0.1:3100/ | grep -Eo 'index-[A-Za-z0-9_-]+\.js' | head -1 || true)
echo "[deploy] old bundle: ${OLD_BUNDLE:-unknown}"

if docker ps --format '{{.Names}}' | grep -qx owl-web-1; then
  docker cp owl-web-1:/usr/share/nginx/html/. "$BACKUP_DIR/" || true
fi

echo "[deploy] building image..."
docker build -t "owl-web:${RELEASE}" -t owl-web:latest .

if docker ps -a --format '{{.Names}}' | grep -qx owl-web-1; then
  NET=$(docker inspect owl-web-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || echo owl_default)
  docker stop owl-web-1
  docker rename owl-web-1 "owl-web-1-backup-${RELEASE}" || true
else
  NET=owl_default
fi

docker run -d \
  --name owl-web-1 \
  --network "$NET" \
  --network-alias web \
  -p 127.0.0.1:3100:80 \
  --restart unless-stopped \
  "owl-web:${RELEASE}"

sleep 2
NEW_BUNDLE=$(curl -s http://127.0.0.1:3100/ | grep -Eo 'index-[A-Za-z0-9_-]+\.js' | head -1 || true)
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)
DETAILS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/details)

echo "[deploy] http=$CODE details=$DETAILS bundle=$NEW_BUNDLE"

if [[ "$CODE" != "200" || -z "$NEW_BUNDLE" || "$NEW_BUNDLE" == "$OLD_BUNDLE" && "$OLD_BUNDLE" == "index-CCdZzxPJ.js" ]]; then
  echo "[deploy] health failed — attempting rollback"
  docker stop owl-web-1 && docker rm owl-web-1 || true
  if docker ps -a --format '{{.Names}}' | grep -qx "owl-web-1-backup-${RELEASE}"; then
    docker rename "owl-web-1-backup-${RELEASE}" owl-web-1
    docker start owl-web-1
  fi
  exit 1
fi

echo "$RELEASE" > releases/CURRENT_RELEASE.txt
echo "$NEW_BUNDLE" > releases/CURRENT_BUNDLE.txt
echo "[deploy] SUCCESS"
echo "Rollback: docker stop owl-web-1 && docker rm owl-web-1 && docker rename owl-web-1-backup-${RELEASE} owl-web-1 && docker start owl-web-1"
