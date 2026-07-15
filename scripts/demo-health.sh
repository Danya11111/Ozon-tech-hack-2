#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ok=0
fail=0

check() {
  local name="$1"
  local url="$2"
  if curl -sf -o /dev/null -w "%{http_code}" "$url" | grep -qE '200|304'; then
    echo "[ok] $name ($url)"
    ok=$((ok + 1))
  else
    echo "[fail] $name ($url)"
    fail=$((fail + 1))
  fi
}

echo "[demo-health] checking endpoints..."
check "prod-loopback" "http://127.0.0.1:3100/" || true
check "preview" "http://127.0.0.1:3101/" || true
check "public" "https://arhipovdan.ru/" || true

echo "[demo-health] running unit tests..."
if npm test >/tmp/demo-health-tests.log 2>&1; then
  echo "[ok] vitest"
  ok=$((ok + 1))
else
  echo "[fail] vitest — see /tmp/demo-health-tests.log"
  fail=$((fail + 1))
fi

echo "[demo-health] summary: ok=$ok fail=$fail"
[[ "$fail" -eq 0 ]]
