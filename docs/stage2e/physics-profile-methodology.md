# Physics profile methodology — Stage 2E

## What is measured

Only Rapier `world.step()` CPU time, via `performance.now()` around each step inside `RapierStepper` (`SorterPhysics.tsx`).

Not included in physics p95:

- Three.js / WebGL render
- React commit
- Asset loading
- Transform sync outside `world.step`

Per-frame sample = sum of substep `world.step` costs that frame (max 4 substeps, `PHYSICS_DT = 1/60`).

## Sampler

- Class: `PhysicsPerfSampler` (`src/domain/physicsPerf.ts`)
- Ring buffer: 1800 samples
- Exposed only with `?perf=1` or `?physicsPerf=1` as `window.__PHYSICS_PERF__`
- Reset: `window.__PHYSICS_PERF_RESET__()`
- **No React state updates in the physics hot loop** — write to ref / `window` only; UI polls at 500 ms

## Profiles

| ID | Intent | Duration | Runs |
|----|--------|----------|------|
| physics-belt-only | CAD + active world, belt / early cycle | ≥30 s | 3 |
| physics-mechanism-contact | Mechanism stroke + one dynamic contact | ≥30 s | 3 |
| physics-drop-collision | Dynamic drop, chute, receiver settle | ≥30 s | 3 |
| physics-worst-case | Continuous playlist @ 1.5× | ≥30 s | 3 |

Reported value per profile = **median of the 3 run p95s**.

## Budget

- Required: physics p95 ≤ 4 ms
- Target: physics p95 ≤ 2 ms

## Hardware

Chromium + `--use-angle=vulkan` (NVIDIA GTX 1080). SwiftShader is not used for verdicts.

## Script

```bash
PERF_BASE_URL=http://127.0.0.1:3101 npx tsx scripts/stage2e-physics-profiles.mts
```
