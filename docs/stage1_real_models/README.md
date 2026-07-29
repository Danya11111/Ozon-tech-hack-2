# Stage 1 — Real 3D Models + Physical Fidelity: artifacts

Status: **PARTIAL_REAL_MODELS_INTEGRATED** — all 9 official product models integrated and
dimension-validated; conveyor stays procedural (`BLOCKED_BY_CAD_CONVERSION`, see below).

## Contents

| File | What it is |
|---|---|
| `STAGE1_REPORT.md` | Full Stage 1 report (21 sections, mirrors the stage spec) |
| `real-models-inventory.md` | Source asset inventory: archives, files, SHA-256, sizes |
| `real-models-validation.json` | Machine-generated dimension/budget validation (11/11 PASS) |
| `conversion-pipeline.md` | Reproducible CAD→Web pipeline + exact commands + conveyor blocker |
| `performance-real-products.json` | Profile B — real products, Cinematic Light, GTX 1080 |
| `performance-real-cinematic.json` | Profile D — real products + post-processing spike, GTX 1080 |
| `performance-low-fallback.json` | Profile E — SVG fallback compatibility, zero model downloads |
| `bundle-impact.md` | JS bundle + asset byte impact vs Stage 0 |
| `console-errors.json` | Aggregated console/page errors across benchmarks and e2e (0) |
| `screenshots/` | 16 evidence screenshots (01–16) |

Profiles A and C have **no JSON by design**: A is the Stage 0 control
(`docs/stage0_premium_3d/performance-cinematic-light.json`), C (real conveyor) is blocked —
see `conversion-pipeline.md`. No fictitious metrics were created.

## Reproduce

```bash
# 1. Validate runtime models against the manifest (writes real-models-validation.json)
node scripts/validate-real-models.mjs

# 2. Benchmarks (app server must run on :3101; PLAYWRIGHT_BASE_URL overrides)
node scripts/stage1-benchmark.mjs

# 3. Evidence screenshots
node scripts/stage1-screenshots.mjs

# 4. Verification mode in the browser
#    http://localhost:3101/?stage1=1&verify=real-models
#    http://localhost:3101/?stage1=1&verify=real-models&sku=SKU-001
```

## Screenshots index

- `01-before-stage1-overview.png` — pre-Stage-1 render (visual golden snapshot from this environment)
- `02-real-products-overview.png` — main scene with real Короб 300 on the belt
- `03–08` — verification cards: box-300, box-400 (oversized), bottle, plate, lunchbox, oversized-round (honest fallback)
- `09-conveyor-conversion-blocked.png` — conveyor stays procedural (evidence, not a fake render)
- `10-dimension-verification.png` — plate bbox + expected/measured dimensions, PASS
- `11-pivot-and-contact-plane.png` — pen lying orientation: axes, bottom pivot, contact plane
- `12/13/14` — routes B / C / D with real items
- `15-details-real-item.png` — `/details` at true physical scale (no 2.5× multiplier)
- `16-mobile-svg-fallback-after-stage1.png` — 390×844 SVG fallback intact
