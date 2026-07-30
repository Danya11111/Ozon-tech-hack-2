# Stage 2B — Bundle Impact

Production build `owl-web:20260730-110405` (vite, `npm run build`).

## JS / CSS chunks (gzipped wire size)

| Chunk | Raw | Gzip | Notes |
|---|---|---|---|
| `SorterDigitalTwinContinuous-*.js` | 4.6 MB | **1.67 MB** | Lazy route chunk: R3F + drei + Rapier WASM + scene. Downloaded only for the 3D tier (never for SVG fallback). |
| `industrialTheme-*.js` | 864 KB | 227 KB | Details page 3D theme chunk (lazy). |
| `index-*.js` (entry) | 348 KB | 104 KB | App shell + domain + HUD. |
| `PostProcessingSpike-*.js` | 160 KB | 74 KB | Only downloaded with `?post=1` spike (§8). |
| `index-*.css` | 44 KB | 9 KB | Global styles. |
| `draco_decoder-*.js/.wasm` | ~1.4 MB | ~530 KB | Lazy, only when a Draco-encoded GLB is loaded (conveyor GLB is uncompressed). |

## Model assets (`/models`, cached `immutable`)

| Asset | Size | Purpose |
|---|---|---|
| `sorter/conveyor-web.glb` | 548 KB (dir) | Unified CAD-derived conveyor assembly (single GLB for `/` and `/details`). |
| `bottle.stl` | 320 KB | SKU-007 (loaded on demand per case). |
| `detergent.stl` | 1.5 MB | SKU-010 (details gallery). |
| `lunchbox.stl` | 568 KB | SKU-002. |
| `pouf.stl` | 632 KB | SKU-005/011. |
| `pen.stl` | 236 KB | SKU-009. |
| `cylinder.stl` | 108 KB | SKU-008. |
| `plate.stl` | 124 KB | SKU-006. |
| `box-300.stl` / `box-400.stl` | 32 KB | SKU-001/004. |

Total `dist/`: **13 MB** (all optional/lazy assets included).

## Budgets (Stage 2 §17)

- Initial route (`/`, 3D tier): entry 104 KB + scene chunk 1.67 MB + conveyor GLB 548 KB ≈ **2.3 MB gzip** — within the 4 MB first-load budget.
- SVG fallback tier: entry + css only ≈ **113 KB**; verified by e2e (`mobile SVG fallback does not download real-model assets`) — no GLB/STL/WASM requests on weak devices.
- Caching: hashed assets `max-age=31536000, immutable`; HTML `no-cache` (nginx.conf).
