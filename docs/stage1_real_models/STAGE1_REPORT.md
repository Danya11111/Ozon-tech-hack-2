# STAGE 1 — REAL 3D MODELS AND PHYSICAL FIDELITY: REPORT

## 1. STAGE_1_STATUS

**PARTIAL_REAL_MODELS_INTEGRATED**

Official products (9/11 SKUs) are real, dimension-validated, and run in the main runtime.
Conveyor remains procedural (`BLOCKED_BY_CAD_CONVERSION` — no CAD kernel in the environment,
FCStd has no tessellated mesh; exact continuation commands documented). 2 SKUs are honest,
marked fallbacks (`NO_EXACT_OFFICIAL_MODEL`).

## 2. EXECUTIVE_SUMMARY

- **Real now**: all 9 official product models from the OZON Tech archives (box-300, lunchbox,
  detergent, box-400, pouf, plate, bottle, cylinder, pen) load in the main scene, routes B/C/D,
  continuous playback, cinematic camera, and `/details`. Dimensions validated 9/9 within
  tolerance max(2 mm, 1 %) by an independent script. Roll cages C/D rebuilt to the real
  1200×800×800 mm bounding box as instanced meshes. `/details` 2.5× scale distortion removed.
  Laser mount height corrected 1.4 m → 1.15 m to match ground truth. Item Y-placement fixed so
  bottom-pivoted models rest on the belt (contact epsilon 0–2 mm).
- **Still procedural**: conveyor frame/belt/gates/pusher (blocked, see §10), sensors rig,
  receiver interiors, SKU-010/011 (marked fallbacks), materials (base colors; PBR is Stage 2).
- **Fidelity**: geometry of every moving item in the demo playlist now matches the physical
  test set within ≤1.8 % per axis; the installation shell is dimensionally correct
  (6000×10000 mm work area, 700 mm belt, 1150 mm laser) but not CAD-derived.
- **Main blocker**: conveyor FCStd conversion (no FreeCAD/Blender/assimp; stage rules forbid
  installing them).

## 3. GIT_SAFETY

| Item | Value |
|---|---|
| Base branch | `feature/premium-3d-stage-0` (working tree) |
| Working branch | `feature/premium-3d-stage-1-real-models` |
| Commit | `5cc27c6` (unchanged — no commits made) |
| Stage 0 external backup | `/tmp/ozone-stage0-before-stage1/` (stage0.patch, stage0-binary.patch, status.txt, untracked-files.tar.gz, untracked-list.txt, checksums, package*.json) — verified readable, patch non-empty |
| Stage 1 rollback tag | `backup/pre-premium-3d-stage-1-20260729-2035` |
| Working tree before | 17 modified + 14 untracked (Stage 0 state) |
| Working tree after | 17 modified + 28 untracked (Stage 0 + Stage 1 files) |
| commit / push / merge / rebase | NO / NO / NO / NO |
| Stage 0 changes preserved | YES — all Stage 0 files still modified/untracked, e2e Stage 0 suite green |

## 4. VERIFIED_FINDINGS

FACTS (checked in code, not assumed):
- Stage 0 state confirmed: fallback, context-loss recovery, cinematic camera, perf overlay,
  lazy PostProcessingSpike all present and functional after Stage 1 (Stage 0 e2e green).
- Domain geometry is millimetres; `physicalLayout.ts` converts to metres for Three.js
  (1 unit = 1 m). `VISUAL_SCALE_MULTIPLIER = 2.5` existed only in `Item3D.tsx` (`/details`) —
  **removed**.
- `conveer.FCStd` is a FreeCAD ZIP document containing b-rep (`*.brp`) — no tessellation.
- Official STL set covers 9 of 11 app SKUs; Мешок and Шлем exist in the archive but have no
  SKU in the app scenario set (registered as `ARCHIVE_ONLY_MODELS`).
- Detergent (3.6 MB) and pen (2 MB) exceeded the 1.5 MB hard budget → decimated
  (vertex clustering, reproducible script).

## 5. SOURCE_ASSET_INVENTORY

See `real-models-inventory.md` (full table with SHA-256). Summary: 9 integrated STLs from
`input_info/doc-1782987733.zip`, 2 archive-only models, 1 FCStd (blocked), 2 app SKUs without
official counterpart.

## 6. CONVERSION_PIPELINE

See `conversion-pipeline.md`. Product path: official STL → analyze (bbox/tris/SHA) →
decimate if over budget → manifest registration → runtime normalization (rotation, mm→m,
bottom-center pivot) → automated validation. All steps dependency-free Node; no system
packages installed; exact commands documented incl. owner-side FreeCAD/Blender conveyor path.

## 7. MODEL_INTEGRATION

| SKU | Before | After | Runtime | Default | Fallback |
|---|---|---|---|---|---|
| SKU-001 Короб 300 | primitive box | real STL 592 tris | box-300.stl | real | primitive |
| SKU-002 ЛанчБокс | primitive | real STL 11 574 tris | lunchbox.stl | real | primitive |
| SKU-003 Моющее | substituted primitive | real decimated STL 29 458 tris | detergent.stl | real | primitive |
| SKU-004 Короб 400 | primitive | real STL 536 tris | box-400.stl | real | primitive |
| SKU-005 Пуфик | substituted capsule | real STL 12 880 tris | pouf.stl | real | primitive |
| SKU-006 Тарелка | primitive disc | real STL 2 504 tris | plate.stl | real | primitive |
| SKU-007 Бутылка | primitive cylinder | real STL 6 522 tris | bottle.stl | real | primitive |
| SKU-008 Цилиндр | primitive | real STL 2 152 tris | cylinder.stl | real | primitive |
| SKU-009 Ручка | substituted box | real decimated STL 4 800 tris, lying demo orientation | pen.stl | real | primitive |
| SKU-010 Boundary 450 | primitive | unchanged primitive, honestly marked | — | fallback | itself |
| SKU-011 Oversized round | substituted helmet STL | honest primitive fallback, marked (no silent substitution) | — | fallback | itself |

## 8. DIMENSION_VALIDATION

From `real-models-validation.json` (machine-generated, 11/11 PASS). Tolerance: max(2 mm, 1 %) per axis, uniform scale only (=1.0 everywhere — no rescaling needed).

| Model | Expected mm (w×d×h) | Measured mm | Max deviation | Result |
|---|---|---|---|---|
| SKU-001 | 300×200×200 | 301×200×200.5 | 0.33 % | PASS |
| SKU-002 | 201×152×62 | 201×152.4×62.3 | 0.48 % | PASS |
| SKU-003 | 259×179×278 | 259.0×179.2×278.2 | 0.13 % | PASS |
| SKU-004 | 401×300×400 | 401×300×400.5 | 0.17 % | PASS |
| SKU-005 | 489×264×489 | 488.9×264×488.9 | 0.02 % | PASS |
| SKU-006 | 210×209×27 | 209.5×209.4×26.5 | 1.75 % | PASS |
| SKU-007 | 91×91×305 | 91.2×91.3×305 | 0.35 % | PASS |
| SKU-008 | 435×50×43 | 435×50×43 | 0 % | PASS |
| SKU-009 | 9×13×148 | 148.5×9×13.1 (lying: rotated) | 0.91 % | PASS |

SKU-010/011: no official expected geometry (fallbacks) — manifest-level PASS.

## 9. AXIS, SCALE AND PIVOT

- All sources are Y-up-ish STLs in millimetres; per-model rotation recorded in the manifest
  (`rotation`, `axisMapping` fields). Example: pen's long axis is source Z(148) → rotated to
  world X for a physically stable **lying** demo orientation (documented, not physics-simulated).
- Uniform scale = 1.0 for every model (sources already match expected sizes within tolerance);
  only the global mm→m conversion is applied.
- Pivot: X/Z = footprint center, Y = geometry bottom (`pivotMode: bottom-center`), baked into a
  cloned geometry in `RealItemModel.normalizeGeometryClone` — shared geometry is never mutated.
- Belt contact: `itemPosition3D` now returns belt-surface Y for the item bottom; verified by
  `stage1Contacts.test.ts` and visually (screenshot 11). No floating, no sinking (ε 0–2 mm).

## 10. CONVEYOR_FIDELITY

| Node | Source | Status |
|---|---|---|
| Frame / belt / gates / pusher | existing procedural geometry, dimensionally correct (500×700 mm conveyor A, sorter B, 700 mm belt height) | PROCEDURAL_FALLBACK |
| Roll cages C/D | rebuilt: real 1200×800×800 mm bbox, open top, instanced rods/frame/wheels | CAD_DERIVED-equivalent procedural (real dimensions) |
| Sensor/laser rig | procedural, laser mount corrected to 1150 mm | PROCEDURAL |
| `conveer.FCStd` | not converted — no CAD kernel available | **BLOCKED_BY_CAD_CONVERSION** |

Conveyor CAD-derived status: none. Polycount/draw calls of the procedural installation are
unchanged from Stage 0 (within budget: scene total 119–122 draw calls, ~41 k tris in view).
Continuation: `conversion-pipeline.md` §Conveyor.

## 11. SCENE_FIDELITY

Fixed mismatches:
1. `/details` 2.5× visual scale — removed; same manifest transform drives both scenes.
2. Laser mount 1.4 m → 1.15 m (matches `MEASUREMENT_SYSTEM_REPORT.md`; measurement math
   unaffected due to existing compensation — business results unchanged).
3. Item Y float (`beltY + 0.12`) — items now rest on the belt plane.
4. Roll cages were abstract transparent boxes — now real-dimensioned readable mesh cages.
5. Pen previously shown as generic box — now the real model in documented lying orientation.

Remaining conventions (declared): procedural conveyor shell, simplified receiver interiors,
no drop physics / center-of-mass simulation (out of stage scope), placeholder materials.

## 12. PERFORMANCE_RESULTS

Hardware: NVIDIA GTX 1080 (ANGLE OpenGL ES 3.2), 3 runs × ≥30 s, median. Full data in the
profile JSONs.

| Profile | GPU | Avg FPS | Min FPS | p5 FPS* | p95 ms | p99 ms | >33 ms | Draw calls | Tris | Load ms | Verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A — Stage 0 Cinematic Light (control) | GTX 1080 | 59.5 | — | — | 17.3 | — | — | — | — | — | PASS (baseline) |
| B — Real products | GTX 1080 | 60.0 | 33.6† | ≈59.9 | 17.1 | 20.0 | 0 | 119 | 40 582 | 770 | **PASS** (≥55 FPS, p95 ≤20 ms) |
| C — Real conveyor + products | — | — | — | — | — | — | — | — | — | — | SKIPPED (conveyor blocked) — no fake JSON |
| D — Real models Cinematic Full (post on) | GTX 1080 | 59.7 | 24.9† | ≈59.2 | 21.6 | 27.3 | 1 | 1‡ | 1‡ | 663 | **PASS** (p95 ≤28 ms) |
| E — Low/fallback (SVG) | n/a | — | — | — | — | — | — | — | — | 116–463 | **PASS** (fallback visible, 0 model requests, 0 errors) |

\* p5 derived from per-frame distribution in the JSONs. † one-time startup dips (shader
compile), not sustained. ‡ Profile D draw calls/triangles read 1 because `renderer.info` is
sampled after the post-processing composer (fullscreen quad) — a known sampling artifact, same
as Stage 0's cinematic-full; scene statistics are authoritative in Profile B.
Software renderer (SwiftShader): not used for any verdict.

## 13. BUNDLE_AND_ASSET_IMPACT

See `bundle-impact.md`. Entry JS +287 B raw / **+101 B gzip** vs Stage 0; no new runtime deps;
9 STLs = 3.55 MB static on-demand (initial preload set 1.33 MB ≤ 2.5 MB budget); largest asset
1.47 MB detergent (post-decimation); SVG fallback fetches 0 model bytes.

## 14. MEMORY_AND_CONTEXT

From benchmark runs: geometries 109–110, textures 3 (light) / 29 (post), programs 10–22,
heap 20.8 MB (light) / 52.6 MB (post) — stable across runs, no monotonic growth over repeated
playlist cycling (Stage 0 leak fixes intact). Context losses: 0 in all profiles. Stage 0
context-loss/recovery e2e still green. Real models are cloned-then-baked; source geometries
stay cached and shared — no per-instance duplication.

## 15. MOBILE_AND_FALLBACK

- SVG fallback intact (Profile E + screenshot 16): `main-svg-fallback` renders, playback
  controls work, details link works.
- **0 real-model requests** on the fallback path (asserted in e2e and Profile E).
- 390×844 verified. Real devices (iPhone/Android/Telegram WebView): **not tested** — policy
  unchanged, mobile real-time 3D still not declared ready.

## 16. TEST_RESULTS

| Suite | Result |
|---|---|
| `npx tsc -b` | PASS |
| `npm test` (unit incl. `modelAssets.test.ts`, `stage1Contacts.test.ts`) | PASS |
| `npm run build` | PASS |
| `scripts/validate-real-models.mjs` | PASS 11/11 (exit 0) |
| Functional e2e (Stage 0 suites + `real-models.spec.ts` 6 tests) | PASS 21/21 |
| Visual regression | 6 expected diffs (03 class C, 04 class D, 05 jam, 06 estop, 07 presentation, 08 details) — verified to be the intended real-model/roll-cage visuals; **goldens NOT overwritten** |
| Console errors | 0 across benchmarks and e2e (`console-errors.json`) |

## 17. KNOWN_LIMITATIONS

- Conveyor not CAD-derived (blocked; documented commands). Profile C unmeasured.
- SKU-010/011 are procedural (no official counterpart) — marked, not hidden.
- Мешок/Шлем have no app SKU; archive-only.
- Demo orientations chosen manually (pen lying); no drop physics.
- Materials are placeholders; transparent-bottle material minimal (Stage 2 scope).
- Mobile untested on real devices; Telegram WebView unverified.
- Visual goldens intentionally stale until a human reviews the 6 expected diffs.
- Profile D renderer.info artifact (post-composer sampling) noted in §12.

## 18. DECISION

- Stage 1 goal (reliable geometric & physical foundation): **achieved for products, partial
  for the installation** → honest status `PARTIAL_REAL_MODELS_INTEGRATED`.
- Products real? **Yes** — official sources, checksums, measured dimensions, validated.
- Conveyor real? **No** — procedural, conversion blocked by environment.
- Reality match: item geometry ≤1.8 % per axis vs ground truth; installation dimensions match
  ground-truth layout values; installation shape remains schematic.
- Performance budget: **passes** (60 FPS, p95 17.1 ms with real models; ≥45/≥55 thresholds met).
- Stage 2: **can proceed**; conveyor conversion is an environment/tooling task for the owner
  (or Stage 2 pre-work with approved tooling).

## 19. NEXT_STAGE (proposal only)

Stage 2 — Visual & Material Fidelity: PBR material authoring for the 9 real models, HDRI
environment, unified visual language, conveyor conversion with approved CAD tooling (then
Profile C), scroll-driven storytelling prototype, real-device mobile validation, possible scene
unification (`/` vs `/details`), GLB+Draco migration.

## 20. FILES_CHANGED

Stage 1 product files (13, within the 25-file scope limit):
`src/data/modelAssets.ts`, `src/components/ThreeD/RealItemModel.tsx` (new),
`src/components/ThreeD/RollCageMesh.tsx` (new), `src/components/ThreeD/RealModelVerification.tsx` (new),
`src/components/ThreeD/PhysicalPlaybackItem.tsx`, `src/components/ThreeD/SorterDigitalTwinContinuous.tsx`,
`src/components/ThreeD/SortingZones3D.tsx`, `src/components/ThreeD/Item3D.tsx`,
`src/components/ThreeD/itemMotion.ts`, `src/domain/physicalLayout.ts` (1-line ground-truth fix),
`src/domain/stage1.ts` (new), `src/pages/MainPage.tsx`, `src/components/ThreeD/STLModel.tsx`.

Tests: `src/data/modelAssets.test.ts`, `src/domain/stage1Contacts.test.ts` (new),
`e2e/real-models.spec.ts` (new).

Scripts: `scripts/stage1-analyze-stl.mjs`, `scripts/stage1-decimate-stl.mjs`,
`scripts/validate-real-models.mjs`, `scripts/stage1-benchmark.mjs`,
`scripts/stage1-screenshots.mjs` (all new, dependency-free).

Generated assets: `public/models/{detergent,pen,pouf}.stl` (decimated/normalized runtime
copies; other 6 STLs already in tree).

Reports/artifacts: `docs/stage1_real_models/` (this file, README, inventory, pipeline,
bundle-impact, console-errors.json, 3 performance JSONs, validation JSON, 16 screenshots).

## 21. FINAL_GIT_CHECK

```
branch : feature/premium-3d-stage-1-real-models
HEAD   : 5cc27c6fc201f3e83cbf48b66d6da980eb1d8ca2 (chore: add unique assets…)
status : 17 modified + 28 untracked — all Stage 0 changes intact, nothing committed
diff   : 17 files changed, 1069 insertions(+), 609 deletions(-); git diff --check clean
tag    : backup/pre-premium-3d-stage-1-20260729-2035
backup : /tmp/ozone-stage0-before-stage1/ (verified)
```
