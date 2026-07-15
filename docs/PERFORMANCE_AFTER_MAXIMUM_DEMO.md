# PERFORMANCE_AFTER_MAXIMUM_DEMO

## Production identity

| Field | Value |
| ----- | ----- |
| Release | `20260715-2215` |
| Bundle | `index-AagIOJbd.js` |
| Commit | `16e7930` (via `/version.json`) |

## software/headless WebGL diagnostic baseline

**Not a live-demo GPU characteristic.**

```text
Average FPS: ~8.9–9.6
Renderer: SwiftShader
Status: BLOCKED_BY_DISPLAY_ENVIRONMENT on server
```

## Replay geometries

Earlier probe showed +12 geometries after 3 replays under SwiftShader.
Re-run on production (`npm run perf:replay-stability`): **STABLE** (147 geos flat through 10 replays; +3 after GC pause only).

## Tooling

| Command | Purpose |
| ------- | ------- |
| `npm run perf:gpu` | Server/xvfb diagnostic |
| `npm run perf:browser` | Portable headed laptop benchmark |
| `npm run perf:replay-stability` | Geometry/heap plateau check |
| `/?perf=1` → Export benchmark | Local JSON download |
