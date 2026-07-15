#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[demo-start] installing deps if needed..."
if [[ ! -d node_modules ]]; then
  npm ci
fi

echo "[demo-start] building production bundle..."
npm run build

PID_FILE="${ROOT}/.demo-preview.pid"
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "[demo-start] preview already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

echo "[demo-start] starting vite preview on 127.0.0.1:3101 (dev preview; prod may already be on :3100)..."
nohup npm run preview -- --host 127.0.0.1 --port 3101 > "${ROOT}/.demo-preview.log" 2>&1 &
echo $! > "$PID_FILE"
sleep 2
curl -sf "http://127.0.0.1:3101/" >/dev/null && echo "[demo-start] OK http://127.0.0.1:3101/" || {
  echo "[demo-start] preview not ready yet — check .demo-preview.log"
  exit 1
}
