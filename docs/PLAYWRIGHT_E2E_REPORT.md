# Playwright E2E + Visual Regression

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run test:e2e` | Local e2e + visual (`--grep-invert @production`) |
| `npm run test:e2e:headed` | Same, headed |
| `npm run test:e2e:update` | Refresh visual baselines (manual review) |
| `npm run test:e2e:production` | Manual production smoke via `PLAYWRIGHT_BASE_URL` |

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:3101` | Target origin |
| `PLAYWRIGHT_START_SERVER` | unset | `1` → auto `vite preview` :3101 |

## Config

- workers: **1**
- retries: **1** (trace on first retry)
- screenshot on failure
- visual: `threshold: 0.35`, `maxDiffPixelRatio: 0.08`
- CI: `npm ci` → `npm test` → `npm run build` → `npm run test:e2e` (no production smoke)

## Test map

| Spec | Coverage |
|------|----------|
| `smoke` | canvas, play |
| `controls` | seek, speed, presentation |
| `safety` | jam / emergency |
| `routes` | `/details` SPA |
| `visual` | 10 snapshots (HUD B/C/D/jam/E-stop/recovery, presentation, details, perf overlay) |
| `production.smoke` | `@production` — manual only |

## Snapshot list

```text
01-home-idle-hud
02-class-b-hud
03-class-c-hud
04-class-d-hud
05-jam-fault-hud
06-emergency-hud
07-presentation-mode
08-details-page
09-recovery-hud
10-perf-overlay
```

HUD snapshots preferred over full WebGL pixel-perfect. Golden files are not auto-updated in CI.

## Latest local run

```text
15 passed (e2e, excl. production)
Unit: 166 passed
Production smoke @ :3100 — PASS (version.json → 4fcce5b, index-AagIOJbd.js)
Production smoke @ Quick Tunnel — PASS (same commit)
Production smoke @ arhipovdan.ru — BLOCKED_EXTERNAL (TLS/DNS)
```
