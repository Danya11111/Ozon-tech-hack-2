# Stage 0 — Bundle Impact Analysis

Measured with `vite build` (production), same machine, same Node toolchain.

- **Before**: rollback tag `backup/pre-premium-3d-stage-0-20260729-1542` (commit `5cc27c6`, `dan_branch` HEAD), built in a temporary git worktree.
- **After**: working tree of `feature/premium-3d-stage-0` (uncommitted Stage 0 changes).

## JavaScript chunks (raw bytes)

| Chunk | Before | After | Δ | Loaded on default route `/`? |
|---|---:|---:|---:|:---|
| `index-*.js` (entry) | 330 630 | 339 427 | **+8 797** | yes |
| `industrialTheme-*.js` (three.js vendor) | 881 879 | 882 923 | +1 044 | yes (3D route) |
| `SorterDigitalTwinContinuous-*.js` | 51 604 | 55 204 | +3 600 | yes (3D route) |
| `SorterDigitalTwin-*.js` | 20 198 | 20 414 | +216 | no (details/lazy) |
| `PerfOverlay-*.js` | 38 363 | 38 363 | 0 | no (perf-gated) |
| `ThreeCapabilityCheck-*.js` | 2 186 | 2 188 | +2 | yes |
| `itemMotion-*.js` | 1 290 | 1 286 | −4 | yes |
| `physicalLayout-*.js` | 12 993 | — (merged into entry split) | −12 993 | — |
| `jsx-runtime-*.js` | — (was inside entry) | 12 036 | +12 036 | yes |
| **`PostProcessingSpike-*.js`** | — | **163 256** | **+163 256** | **NO — lazy, only `?stage0=1&post=1`** |

## Gzip (wire size)

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| entry `index-*.js` gzip | 98 582 | 101 445 | **+2 863 B (+2.9 %)** |
| `PostProcessingSpike-*.js` gzip | — | 75 925 | lazy-only, **0 B on default route** |
| total `dist/` (all assets, raw) | 2 575 307 | 2 752 127 | +176 820 B |

## What the entry delta contains

+2.9 kB gzip on the entry chunk covers: `domain/stage0.ts` (query-param parser, device-signal
collection, prototype quality selection), `domain/playbackAdapter.ts` (playback → SVG simulation
mapping for the honest fallback), and the context-loss/recovery + fallback branching in
`MainPage.tsx` / `SorterDigitalTwinContinuous.tsx`.

## New runtime dependencies

| Package | Version | Where it lands |
|---|---|---|
| `@react-three/postprocessing` | ^3.0.4 | exclusively in lazy `PostProcessingSpike` chunk |
| `postprocessing` | ^6.39.4 | exclusively in lazy `PostProcessingSpike` chunk |

Verified: neither package is reachable from the default-route module graph — the spike component
is `React.lazy(...)`-loaded and rendered only when `stage0.post` is true. The 163 kB (76 kB gzip)
chunk is **never fetched** on `/` or on `/?stage0=1` without `post=1`.

## Verdict

- Initial-bundle regression: **+2.9 kB gzip — negligible**.
- Prototype/post-processing weight: fully isolated in a lazy chunk (production visitors pay 0 B).
- Stage 0 bundle budget: **PASSED**.
