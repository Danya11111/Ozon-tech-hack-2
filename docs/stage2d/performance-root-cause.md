# Performance root cause — Stage 2C FAIL

## Verdict

Stage 2C `performance: FAIL` was **not** a measured hardware FPS failure.

Evidence from `docs/stage2c_cad_visual/performance-*.json`:

- `status: NOT_REMEASURED` / `measured: null`
- Explicit note: formal multi-run GPU profile deferred

## Classification

**INSUFFICIENT_HARDWARE_PERFORMANCE_DATA** (Stage 2C) — profiles never run on a hardware renderer.

## Environment (Stage 2D probe)

| Path | Renderer |
|---|---|
| Playwright default / SwiftShader | `ANGLE (... SwiftShader Device (Subzero) ...)` |
| Playwright `--use-angle=vulkan` | `ANGLE (NVIDIA, ... GeForce GTX 1080 ...)` |
| Host | 2× NVIDIA GeForce GTX 1080 (driver 580.126.09) |

SwiftShader results must **not** be used for PASS/FAIL.

## Likely cost drivers (code audit, pre-optimization)

1. CAD GLB ~159k tris, every mesh `castShadow` when shadows on
2. Demo quality: `dprMax 1.5`, AA on, PCFSoft shadows
3. Hybrid Rapier always mounted on continuous twin
4. Modular belt extensions add extra meshes/rollers
5. ACES + soft shadows default (Stage 2 premium look)

## Regression narrative

| Stage | Note |
|---|---|
| Stage 0 | Cinematic light / optional post — measured in Stage 0 docs |
| Stage 1 | Real STL products |
| Stage 2B | CAD GLB + Rapier drops + soft shadows default |
| Stage 2C | UI/layout/motor cleanup; **no new GPU matrix** → FAIL by omission |

No single commit proves FPS regression without Stage 2C numbers; Stage 2D supplies hardware matrix.
