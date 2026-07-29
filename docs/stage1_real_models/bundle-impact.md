# Stage 1 — Bundle & asset impact

Baseline: Stage 0 `bundle-analysis.md` (index 339 427 raw / 101 445 gzip).
Measured on the current working tree build (`vite build`, same machine).

## JavaScript

| Chunk | Stage 0 | Stage 1 | Δ raw | Δ gzip |
|---|---:|---:|---:|---:|
| `index-*.js` (entry, default route) | 339 427 | 339 714 | **+287 B** | **+101 B** |
| `SorterDigitalTwinContinuous-*.js` (3D route) | 55 204 | 55 708 | +504 B | — |
| `industrialTheme-*.js` (three.js vendor) | 882 923 | 882 932 | +9 B | — |
| `PostProcessingSpike-*.js` (lazy, `post=1` only) | 163 256 | 163 256 | 0 | 0 |

Stage 1 product code (manifest, `RealItemModel`, `RollCageMesh`, verification overlays,
stage1 config) fits in **< 1 kB gzip on the default route** — normalization is math on
already-loaded geometry; no new runtime dependency was added.

## 3D assets (loaded on demand, not part of the JS bundle)

| Metric | Value |
|---|---:|
| Total runtime STLs (`public/models`, 9 files) | 3 551 656 B (3.55 MB) |
| Initial scene payload (6 preload SKUs in the demo playlist) | 1 326 900 B (1.33 MB) — budget ≤ 2.5 MB: **PASS** |
| Largest single asset | `detergent.stl` — 1 472 984 B (hard limit 1.5 MB: PASS, after decimation) |
| Lazy assets | detergent/pouf/cylinder load when their playlist case starts |
| Compression | none (binary STL, served statically; GLB+Draco is a Stage 2 option) |
| SVG fallback downloads | 0 model bytes (verified in Profile E + e2e) |

## Dependencies

New runtime dependencies: **none**. New dev tooling: two dependency-free Node scripts
(`stage1-analyze-stl.mjs`, `stage1-decimate-stl.mjs`) + validation/benchmark/screenshot
scripts; `typescript` (existing devDependency) reused by the validator.

## Total `dist/`

2 752 127 B → 5 117 376 B. The +2.37 MB delta is the copied `models/` directory
(static on-demand assets), not JavaScript; wire cost on the default route is the 6-STL
preload set above, fetched only when the 3D scene actually mounts.
