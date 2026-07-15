# Playwright E2E + Visual Regression

Lightweight end-to-end and visual regression coverage for the continuous demo on `/` and the SPA route `/details`.

## Prerequisites

- Node.js with project deps installed (`npm install`)
- Chromium for Playwright: `npx playwright install chromium`
- App reachable at the base URL (default preview: `http://127.0.0.1:3101`)

By default tests **do not** start a server. Start preview yourself, for example:

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 3101
```

Or point at an already-running preview/prod instance via `PLAYWRIGHT_BASE_URL`.

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test:e2e` | `playwright test` | Run all e2e + visual tests |
| `test:e2e:headed` | `playwright test --headed` | Same, headed browser |
| `test:e2e:update` | `playwright test --update-snapshots` | Refresh visual baselines |

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:3101` | Target app origin |
| `PLAYWRIGHT_START_SERVER` | unset | Set to `1` to let Playwright run `vite preview` on port 3101 |

Examples:

```bash
# Against local preview (already running)
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npm run test:e2e

# Against prod-style port
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e

# Auto-start preview if nothing is listening
PLAYWRIGHT_START_SERVER=1 npm run test:e2e
```

## Config highlights

- **workers: 1** — keep e2e light on shared servers
- **retries: 1**
- **chromium only**
- Screenshot on failure; trace on first retry
- Soft visual thresholds (`threshold: 0.3`, `maxDiffPixelRatio: 0.05`)

## Test map

| Spec | Coverage |
|------|----------|
| `e2e/smoke.spec.ts` | `/` loads, canvas (or loading→canvas), no `pageerror`, play works, replay if finished |
| `e2e/controls.spec.ts` | next/prev seek, jump case 0 & 8, speed buttons, presentation toggle |
| `e2e/safety.spec.ts` | jam (index 8) → FAULT; emergency (index 9) → EMERGENCY |
| `e2e/routes.spec.ts` | `/details`, refresh stays on details, navigate back to `/` |
| `e2e/visual.spec.ts` | Idle HUD panel snapshot only (not full WebGL canvas) |

Stable selectors live on `MainPage` as `data-testid` values (`demo-play`, `demo-hud`, `demo-case-{n}`, etc.).

## Updating visual snapshots

1. Ensure the app at `PLAYWRIGHT_BASE_URL` matches the UI you want to lock.
2. Run:

```bash
npm run test:e2e:update
```

3. Review diffs under `e2e/visual.spec.ts-snapshots/` (and commit those PNGs when intentional).
4. Re-run `npm run test:e2e` to confirm green.

Snapshots intentionally target **`[data-testid="demo-hud"]`** so WebGL canvas noise does not fail CI.

## System deps

On a fresh Linux host, Chromium may need OS libraries:

```bash
npx playwright install chromium
npx playwright install-deps chromium
```

## Artifacts (gitignored)

- `test-results/` — failure screenshots / traces
- `playwright-report/` — HTML report
- `blob-report/` — blob reporter output
`}