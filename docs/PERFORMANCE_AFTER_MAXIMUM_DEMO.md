# PERFORMANCE_AFTER_MAXIMUM_DEMO

Measured: 2026-07-15T17:11:06.031Z  
Commit: `985f7c3`

## Bundle (measured)

| Метрика | Значение |
| ------- | -------: |
| Total JS | 1300.9 KB |
| Total JS gzip | 358.1 KB |
| Main chunk | index-ncgt6PBL.js (96.4 KB gzip) |
| R3F chunk gzip | 226.1 KB |

## Runtime (Playwright Chromium headless)

| Метрика | До | После | Цель | Статус |
| ------- | -: | ----: | ---: | ------ |
| Average FPS | n/a (не измерялось) | 9.6 | ≥30 | CHECK |
| Minimum FPS | n/a | 3.3 | ≥20 | CHECK |
| p95 frame time | n/a | 200.1 ms | ≤33 ms | CHECK |
| Load time | n/a | 1008 ms | ≤5000 | OK |
| JS heap start | n/a | 13400000 | — | measured |
| JS heap after interaction | n/a | 13400000 | no runaway | measured |
| Canvas present | — | 1 | ≥1 | OK |
| JS gzip (main+vendor) | ~335 KB main previously | 358.1 KB | — | measured |

## Notes

- **Headless Chromium WebGL is not a GPU FPS measurement.** Values ~9 FPS / p95 ~200 ms reflect software/SwiftShader-like rendering in CI/headless, **not** desktop Chrome with NVIDIA. Do not claim 30–60 FPS from this pass.
- For jury/demo FPS, measure in headed Chromium on the presentation machine (`npm run test:e2e:headed` + DevTools Performance) or Engineering Details FPS meter.
- Draw calls / triangles require WebGL inspector in headed mode; not available in this headless pass.
- Demo quality mode keeps `shadows=false` and `effectsEnabled=false` for stable real-device FPS (see `qualityMode.ts`). High mode may enable shadows.
- Raw JSON: `agent/reports/perf-metrics.json`
- Runtime error (if any): none
