#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="${ROOT}/.demo-preview.pid"
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" || true
    echo "[demo-stop] stopped pid $pid"
  fi
  rm -f "$PID_FILE"
else
  echo "[demo-stop] no preview pid file"
fi
pkill -f "vite preview --host 127.0.0.1 --port 3101" 2>/dev/null || true
