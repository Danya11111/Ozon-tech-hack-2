# STAGE 2D REPORT — Performance Recovery / Real Mechanism / Phone-Ready

## 1. STAGE_2D_STATUS

**PARTIAL_SORTER_PERFORMANCE_AND_MECHANISM**

Hardware GPU performance PASS (GTX 1080). SPEC_DERIVED_CAD mechanism shipped (not author REAL_CAD). Domain/phone blocked or untested. Runtime WebM partial.

## 2. EXECUTIVE_SUMMARY

- Stage 2C performance FAIL root cause: **no hardware measurements** (`NOT_REMEASURED`), not proven low FPS.
- Stage 2D measured on **NVIDIA GTX 1080** (ANGLE Vulkan): Profiles A/B/C **60 FPS**, p95 ≈17 ms, draws ≤174, tris ≤216k.
- Optimizations: selective CAD shadows, shadow map 1024, demo DPR 1.25, maxVisibleItems 4.
- Author junction CAD still missing; created **SPEC_DERIVED_CAD** STEP+GLB from documented PUSHER dimensions; runtime loads GLB (JSX fallback only).
- Drop 7/7×10/10; runtime/headless hash `7ee15ad3e879a44a` unchanged equal.
- `/device-test` added; real phone **NOT_TESTED**; `sorter.arhipovdan.ru` still **BLOCKED**.

## 3. GIT_SAFETY

- Backup `/tmp/ozone-before-stage2d/`
- Tag `backup/pre-stage2d-performance-mechanism-20260730-1241`
- Branch `feature/ozon-sorter-stage-2d-performance-mechanism`

## 4. PERFORMANCE_ROOT_CAUSE

See `performance-root-cause.md`. Stage 2C FAIL = missing hardware matrix.

## 5. PERFORMANCE_OPTIMIZATIONS

| Change | Before | After | Impact | Tradeoff |
|---|---|---|---|---|
| CAD shadow casters | all meshes | frame/belt/gate/inspection/motor | fewer shadow draws | rollers no cast |
| Shadow map | 2048 | 1024 | cheaper shadows | softer edges |
| Environment res | 128 | 64 | less GPU | slightly flatter IBL |
| demo/high dprMax | 1.5 | 1.25 | pixel fill ↓ | less retina sharpness |
| maxVisibleItems demo | 6 | 4 | fewer SKUs | demo density |
| Mechanism visual | JSX boxes | SPEC_DERIVED_CAD GLB | CAD source | still not author CAD |

## 6. PERFORMANCE_RESULTS

GPU: NVIDIA GeForce GTX 1080 (ANGLE Vulkan)

| Profile | GPU | Avg FPS | Min | P95 | Physics P95 | Draw calls | Tris | Result |
|---|---|---|---|---|---|---|---|---|
| A CAD Light | GTX 1080 | 60 | — | 16.8 | N/A* | 162 | 182k | PASS |
| B CAD+Physics | GTX 1080 | 60 | — | 17.0 | N/A* | 152 | 197k | PASS |
| C Full runtime | GTX 1080 | 60 | — | 17.1 | N/A* | 174 | 216k | PASS |
| D Cinematic full | GTX 1080 | 60 | 33 | 17.1 | N/A* | (instr.) | (instr.) | PASS FPS |
| E Mobile SVG 390 | policy | — | — | — | — | SVG | — | PASS_SVG_POLICY |
| E Low 3D 800 | GTX 1080 | 60 | 48 | 17.1 | N/A* | 109 | 177k | PASS |

\*Physics step timing not separately instrumented (fixed 1/60, ≤4 substeps).

## 7. MECHANISM_SOURCE_SEARCH

See `mechanism-source-search.md`. No author junction paddle in any branch/archive.

## 8. MECHANISM_CAD

- Status: **SPEC_DERIVED_CAD**
- Files: `3d_models/sorter_mechanism.step`, `.params.json`, `public/models/sorter/mechanism-web.glb`
- Dimensions from PUSHER + mechanism-map (documented)

## 9. RUNTIME_MECHANISM

- Domain: `getPusherState` / kinematic Rapier
- Collider: cuboid matching PUSHER (parity)
- Visual: CAD GLB default; JSX Suspense fallback

## 10. RUNTIME_PHYSICS_REALISM

Headless contact PASS; runtime WebM missing → PARTIAL visual.

## 11. DROP_VALIDATION

7/7 × 10/10, 0 teleport, pusher contact on C/D. See `drop-validation.json`.

## 12. RUNTIME_HEADLESS_PARITY

Hash `7ee15ad3e879a44a` equal — PASS.

## 13. REAL_PRODUCT_FIDELITY

Scale unchanged; real STL default preserved.

## 14. MOBILE

`/device-test` + SVG policy at &lt;640px. Real phone NOT_TESTED.

## 15. PUBLIC_DOMAIN

BLOCKED_BY_DEPLOYMENT_ACCESS — openresty/SNI.

## 16. DEPLOYMENT

`:3100` updated Stage 2D; rollback retained.

## 17. TEST_RESULTS

- tsc / vitest 199 / build PASS
- drop 7/7 PASS
- stage2c layout e2e previously green

## 18. KNOWN_LIMITATIONS

- Not author REAL_CAD mechanism
- No FreeCAD binary → STEP+params instead of FCStd
- No runtime WebM
- Physics p95 not separately metered
- Domain/phone incomplete
- Profile D drawCall counter unreliable under post

## 19. DECISION

| Question | Answer |
|---|---|
| Performance FAIL fixed? | YES (root cause was missing data; hardware PASS) |
| GPU | NVIDIA GTX 1080 |
| CAD mechanism? | SPEC_DERIVED_CAD (not REAL_CAD) |
| Contact? | PASS (headless + kinematic) |
| Runtime falls realistic? | PARTIAL (no WebM) |
| Runtime/headless? | PASS |
| Domain? | BLOCKED |
| Phone? | NOT_TESTED |

## 20. FILES_CHANGED

See git commit.

## 21. FINAL_GIT_CHECK

(after commit)
