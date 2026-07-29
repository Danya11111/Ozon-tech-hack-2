# Stage 0 — Premium 3D Feasibility (artifacts)

Technical feasibility checkpoint executed on branch `feature/premium-3d-stage-0` (from
`dan_branch` @ `5cc27c6`, rollback tag `backup/pre-premium-3d-stage-0-20260729-1542`).

**Verdict: `REALTIME_3D_CONDITIONAL`** — desktop real-time 3D is viable on hardware GPU;
mobile real-time 3D is unproven (no real device available) and must ship the hybrid
SVG/low-profile fallback. See [STAGE0_REPORT.md](./STAGE0_REPORT.md).

## Contents

| File | What it is |
|---|---|
| [STAGE0_REPORT.md](./STAGE0_REPORT.md) | Full 15-section Stage 0 report (facts, changes, metrics, decision) |
| [performance-baseline.json](./performance-baseline.json) | Profile 1 — original scene, light bg, no shadows/camera/post (3 runs × 32 s, GTX 1080) |
| [performance-cinematic-light.json](./performance-cinematic-light.json) | Profile 2 — dark bg, cinematic rig, ACES, shadows 1024, camera on (3 runs) |
| [performance-cinematic-full.json](./performance-cinematic-full.json) | Profile 3 — Profile 2 + Bloom/Vignette/Noise spike (3 runs) |
| [performance-mobile-low.json](./performance-mobile-low.json) | Profile 4 — low preset, DPR 1, no shadows/post, mobile emulation (3 runs) |
| [console-errors.json](./console-errors.json) | Aggregated console/page errors across all runs and e2e |
| [bundle-analysis.md](./bundle-analysis.md) | Bundle before/after (entry +2.9 kB gzip; post-processing fully lazy) |
| [screenshots/](./screenshots/) | 01 baseline, 02 cinematic-light, 03 cinematic-full, 04 mobile SVG fallback, 05 auto-cam inspection, 06 auto-cam route-C, 07 context-loss fallback |

## Reproduce

```bash
npm run build && npm run preview        # serves dist on the first free port (3101 in our runs)
node scripts/stage0-benchmark.mjs       # 4 profiles × 3 runs × 32 s, writes performance-*.json
node scripts/stage0-camera-shots.mjs    # screenshots 05/06
PLAYWRIGHT_START_SERVER=1 npx playwright test e2e/mobile-fallback.spec.ts
```

Headless GPU flags used (without them Chromium falls back to SwiftShader and results are
**not** valid GPU baselines): `--use-gl=angle --use-angle=gl-egl --enable-gpu
--ignore-gpu-blocklist --disable-software-rasterizer --disable-vulkan-surface`.

Prototype mode query grammar: `/?stage0=1&shadows=1&camera=1&post=0&quality=medium&perf=1&adaptive=1&shot=inspection&hud=0`
(shots: `overview`, `inspection`, `route-b`, `route-c`, `route-d`, `safety`).
