#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "[demo-reset] stopping preview..."
"${ROOT}/scripts/demo-stop.sh" || true
echo "[demo-reset] clearing agent kill switch / temp preview logs..."
rm -f "${ROOT}/.demo-preview.log" "${ROOT}/agent/state/KILL" || true
echo "[demo-reset] done — open app and press R (or Stop) to reset demo state in browser"
