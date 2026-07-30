# STAGE 2C REPORT — CAD Assembly Correction / Visual Cleanup / Runtime Physics

## 1. STAGE_2C_STATUS

**PARTIAL_CAD_VISUAL_PHYSICS**

Primary UI/layout/assembly defects addressed. Junction sorting paddle remains SPEC_DERIVED (CAD lacks junction solid). Formal GPU multi-run profiles and runtime WebM not completed. Public domain still blocked.

## 2. EXECUTIVE_SUMMARY

- White MEASUREMENT overlay (`CVInspectionOverlay`) no longer mounts on `/` (debug-only).
- Canvas fills viewport (`100dvh` + absolute `.canvas-holder`); emptyRatio=0 measured.
- Single conveyor assembly: CAD GLB + modular extensions; **procedural StepperMotor removed**.
- Author CAD audited: only `3d_models/conveer.FCStd` machine CAD; product STLs separate.
- Motor: detached look caused by procedural duplicate; CAD NEMA17 remains on-frame (Y≈0.58).
- Opaque machine materials forced (`transparent=false`, `depthWrite=true`).
- Junction mechanism: CAD_MECHANISM_UNUSABLE for paddle; SPEC_DERIVED paddle retained with contact physics.
- Runtime/headless config hash equal; drop validation 7/7×10/10.
- Production `:3100` updated with Stage 2C dist; `sorter.arhipovdan.ru` still blocked.

## 3. GIT_SAFETY

- Branch: `feature/ozon-sorter-stage-2c-cad-visual-physics`
- Backup: `/tmp/ozone-before-stage2c/`
- Tag: `backup/pre-stage2c-cad-visual-physics-20260730-1220`
- No force-push / reset / stash / main / dan_branch edits

## 4. CAD_SOURCE_INVENTORY

See `cad-source-inventory.json`. Author machine CAD: **one** FCStd (`3d_models/conveer.FCStd`, 42 PartDesign bodies). Runtime GLB `public/models/sorter/conveyor-web.glb`. Contact sheet: `screenshots/cad-contact-sheet.png`.

## 5. CAD_RUNTIME_AUDIT

See `cad-runtime-audit.json`, `cad-node-hierarchy.json`. Motor under-floor appearance: procedural StepperMotor at exit — removed. CAD motor AABB on frame.

## 6. SINGLE_CONVEYOR_ASSEMBLY

| Module | CAD source | Count | Transform source | Runtime status |
|---|---|---|---|---|
| Frame/profiles | FCStd Link*/Body* | many | bake+worldPlacement | REAL_CAD |
| Belt | Body018 Лента | 1 | bake | REAL_CAD |
| Rollers | Ролик/Вал/узлы | several | bake + spin pivots | REAL_CAD |
| Motor/drive | NEMA17+шкивы | 1 set | bake | REAL_CAD |
| Stop gates | Барьер* | 2 | bake + lift | REAL_CAD |
| Servo mounts | Серво* | several | bake static | REAL_CAD |
| Entry/exit | modular BeltSection | 2 | CAD pitch params | SPEC_DERIVED |
| Junction paddle | — | 1 | pusherMotion | SPEC_DERIVED |

## 7. MOTOR_AND_DRIVE

- Source node: `motor-and-drive/NEMA17`
- Old detached position: procedural at `CONVEYOR_END_X` (exit)
- Cause: duplicate procedural StepperMotor
- Corrected: procedural removed; CAD motor world ≈ (−2.04, 0.58, 0.25)
- Screenshot: `screenshots/04-motor-correct-position.png`

## 8. GEOMETRY_AND_NORMALS

- Opaque materials forced in ConveyorCadModel
- Normals: pipeline `fix_normals` at assemble; no blanket runtime recompute
- Anti-aliasing: existing quality settings
- Remaining: CAD vs extension material contrast; no new bevel/solidify pass

## 9. SORTING_MECHANISM

- CAD source for junction paddle: **none** → CAD_MECHANISM_UNUSABLE
- Runtime: SPEC_DERIVED `PusherMechanism` + Rapier kinematic contact
- See `mechanism-cad-map.md`

## 10. UI_AND_LAYOUT

- Measurement full panel: `/?debug=1&measurement=full` only
- Canvas: `100dvh`, canvas-holder absolute inset 0
- Controls overlay bottom; compact HUD top-right

## 11. REAL_MODEL_SCALE

Ground-truth mm preserved (no artificial enlargement). Belt 500 mm reference unchanged.

| SKU | Expected mm | World mm | Belt width % | Result |
|---|---|---|---|---|
| box 300 | 300 | 300 | 60% | PASS (unchanged) |
| oversized 401 | 401 | 401 | ~80% | PASS |
| bottle 91 | 91 | 91 | ~18% | PASS |
| plate 210 | 210 | 210 | 42% | PASS |
| pen | 9–13 | same | thin | PASS |
| cylinder 435 | 435 | 435 | ~87% | PASS |

## 12. RUNTIME_PHYSICS

- Timestep 1/60 shared (`physicsTimestep.ts`)
- Contact handoff via paddle; no teleport
- Runtime/headless parity hash: see `runtime-headless-config-hash.json`

## 13. DROP_VALIDATION

Copied from Stage 2B re-run: **7/7 PASS**, 10/10 each, pusher contact on C/D, 0 teleports. Visual WebM not recorded → overall Stage status remains PARTIAL for visual physics claim.

## 14. VISUAL_QUALITY

Improved: no measurement white panel, full-height canvas, no procedural motor, opaque CAD materials. Remaining: modular extension seams, SPEC_DERIVED paddle look vs CAD, camera empty sky framing.

## 15. PERFORMANCE

Formal profiles A–D marked NOT_REMEASURED / PARTIAL in JSON artifacts. Build + unit tests pass.

## 16. MOBILE

SVG fallback retained; e2e layout assertions added. Real phone NOT_TESTED.

## 17. DEPLOYMENT

`:3100` updated with Stage 2C dist. Public domain blocked. See `deployment-report.md`.

## 18. TEST_RESULTS

- `npx tsc -b` PASS
- `npm test` PASS (199+)
- `npm run build` PASS
- Drop validation 7/7 PASS
- e2e `stage2c-layout.spec.ts` added

## 19. KNOWN_LIMITATIONS

- Junction paddle SPEC_DERIVED
- Entry/exit SPEC_DERIVED modular
- No runtime WebM in artifacts
- GPU performance matrix not re-run
- Public DNS/TLS blocked externally

## 20. DECISION

| Question | Answer |
|---|---|
| White panel removed? | YES (default) |
| Empty area fixed? | YES (canvas fill; camera framing ≠ layout bug) |
| Single conveyor? | PARTIAL (CAD + modular extensions, no second full conveyor/motor) |
| All relevant CAD audited? | YES (one author FCStd + inventory) |
| Motor correct? | YES (procedural duplicate removed) |
| Volumetric / opaque? | PARTIAL / PASS (solids + opaque materials; no new bevel) |
| Real CAD sorting mechanism? | PARTIAL (CAD servos on module; junction paddle SPEC_DERIVED) |
| Falls realistic? | PARTIAL (headless+hash PASS; WebM missing) |
| Runtime/headless match? | YES |
| Performance? | PARTIAL (not remeasured) |

## 21. FILES_CHANGED

- `src/pages/MainPage.tsx` — measurement modes
- `src/styles.css` — full-height canvas-holder / 100dvh
- `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` — SorterCadAssembly, remove StepperMotor, CAD pitch
- `src/components/ThreeD/ConveyorCadModel.tsx` — opaque materials
- `src/domain/cadAssemblyParams.ts`, `physicsConfigHash.ts`, `physicsTimestep.ts`
- `src/domain/physicsDropSim.ts`, `SorterPhysics.tsx` — shared timestep
- `e2e/stage2c-layout.spec.ts`, `src/domain/stage2cCadVisual.test.ts`
- `docs/stage2c_cad_visual/**`

## 22. FINAL_GIT_CHECK

(see working tree at end of session)
