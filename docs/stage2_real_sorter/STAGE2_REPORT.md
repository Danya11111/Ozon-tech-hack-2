# STAGE 2 REPORT — Final Realism / Continuous Sorting / Public Mobile

## 1. STAGE_2_STATUS

**PARTIAL_REAL_SORTER_SIMULATION** + **BLOCKED_BY_DEPLOYMENT_ACCESS**

Local product is ready (CAD conveyor unified, continuous scan, physical paddle
contact, 7/7 drop validation 10/10, RealSense SPEC_DERIVED). Permanent HTTPS
hostname `sorter.arhipovdan.ru` is blocked by external openresty/DNS. Real phone
not tested.

## 2. EXECUTIVE_SUMMARY

- Conveyor: single CAD GLB (`conveyor-web.glb`, 544 KB, ~159k tris, 42 nodes) on `/` and `/details`.
- Volumetric: REAL_CAD solids for frame/rollers/motor/gate; SPEC_DERIVED paddle + D435i + chutes.
- RealSense D435i: datasheet-derived housing, lens-down on gantry, FOV debug overlay.
- Continuous measurement: item never stops under camera; `scanProgress` from position.
- Sorting: angled paddle kinematic body; contact-based C/D routing.
- Drop validation: **7/7 PASS**, 10/10 each, pusher contact asserted, no teleports.
- Domain classifier unchanged.
- Public domain: production on `:3100` + Quick Tunnel; `sorter.arhipovdan.ru` TLS/vhost absent.
- Phone: NOT_TESTED_ON_REAL_PHONE (SVG + Mobile Low policies covered in e2e).

## 3. GIT_SAFETY

- Branch: `feature/ozon-sorter-stage-2-real-machine`
- Backup: `/tmp/ozone-before-stage2-finalization/`
- Tag: `backup/pre-stage2-finalization-*`
- Checkpoint Stage 0+1 preserved (`394c513`)
- No force-push / reset / stash

## 4. CAD_AND_GEOMETRY

| Node group | Source | Volume | Runtime | Result |
|---|---|---|---|---|
| static-frame | REAL_CAD | solids | ConveyorCadModel | PASS |
| rollers | REAL_CAD | solids, spin animated | ConveyorCadModel | PASS |
| motor-and-drive | REAL_CAD | solids | ConveyorCadModel | PASS |
| conveyor-belt | REAL_CAD | solids | ConveyorCadModel | PASS |
| inspection-frame | REAL_CAD | solids | ConveyorCadModel | PASS |
| stop-gate | REAL_CAD | solids, lift stroke | ConveyorCadModel | PASS |
| pusher-servo (CAD) | REAL_CAD visual | — | present in GLB | PARTIAL (runtime uses SPEC_DERIVED paddle) |
| angled paddle | SPEC_DERIVED | volumetric | PusherMechanism | PASS |
| RealSense D435i | SPEC_DERIVED | volumetric | RealSenseD435i | PASS |
| chutes / cages | SPEC_DERIVED | volumetric | Continuous scene | PASS |

Old twin deleted: `SorterDigitalTwin`, `Conveyor3D`, `Actuator3D`, `SensorRig3D`, `SortingZones3D`.

## 5. REALSENSE_D435I

See `camera-realsense-spec.md`. Optical axis −Y, optical height 0.65 m above belt,
laser separate. Debug frustum via `?debug=1&physics=1`.

## 6. CONTINUOUS_MEASUREMENT

| | Old | New |
|---|---|---|
| Under camera | dwell / stop | continuous 1.0 m/s |
| scanProgress | time-based | position (`SCAN_START_X`…`SCAN_END_X`) |
| Classification deadline | — | before `MECHANISM_CONTACT_X` |

Tests: `continuousMeasurement.test.ts` — beltVelocity > 0, item x increasing.

## 7. SORTING_MECHANISM

See `mechanism-map.md`. Driven by `physicsSimClock` (Rapier steps), not domain
wall clock — prevents tunneling under render lag.

## 8. PHYSICS

- Hybrid: kinematic belt → dynamic at junction → freeze after rest/sleep.
- Handoff checked **before** kinematic drive (no lag teleport).
- Settle budget in physics seconds (`SETTLE_BUDGET_SEC`).
- Profiles: `visualPhysicsProfiles.ts` (+ SKU-005 pouf).
- Deterministic headless sim mirrors runtime.

## 9. DROP_VALIDATION

| SKU | Zone | Runs | Correct | Penetrations | Teleports | Pusher | Result |
|---|---|---|---|---|---|---|---|
| SKU-001 | B | 10 | 10 | 0 | 0 | n/a | PASS |
| SKU-009 | C | 10 | 10 | 0 | 0 | 10 | PASS |
| SKU-005 | C | 10 | 10 | 0 | 0 | 10 | PASS |
| SKU-004 | C | 10 | 10 | 0 | 0 | 10 | PASS |
| SKU-007 | D | 10 | 10 | 0 | 0 | 10 | PASS |
| SKU-006 | D | 10 | 10 | 0 | 0 | 10 | PASS |
| SKU-008 | D | 10 | 10 | 0 | 0 | 10 | PASS |

Source: `drop-validation.json`.

## 10. REAL_MODEL_VISIBILITY

| SKU | Expected | % belt W | Material | Result |
|---|---|---|---|---|
| SKU-001 box | 300×200×200 | 60% | cardboard | PASS |
| SKU-002 lunchbox | 201×152×62 | 40% | plastic | PASS |
| SKU-004 oversized | 401×300×400 | 80% | cardboard | PASS |
| SKU-006 plate | 210×209×27 | 42% | ceramic | PASS |
| SKU-007 bottle | 91×91×305 | 18% | transparent plastic | PASS |
| SKU-008 cylinder | 435×50×43 | 87% | metal | PASS |
| SKU-009 pen | 9×13×148 | 2% | glossy (not enlarged) | PASS |

## 11. VISUAL_QUALITY

- Premium industrial dark default; ACES; PCFSoft; Lightformers.
- Ambient/fill/rim brightened in 2B for volume readability.
- Overview camera tightened (4.3 / 2.9 / 4.6, fov 46).
- Autostart demo on `/`.

## 12. PERFORMANCE

See `performance-cad-*.json`. Desktop targets remain the budget; SwiftShader
CI is not a GPU proof. Context loss = 0 in e2e recover path.

## 13. MOBILE

- Capability policy → SVG / Mobile Low / desktop.
- SVG continuous motion + B/C/D without GLB.
- Telegram WebView forced SVG.
- Real phone: **NOT_TESTED_ON_REAL_PHONE**.

## 14. PUBLIC_DOMAIN

| | |
|---|---|
| Preferred hostname | `sorter.arhipovdan.ru` |
| DNS A | 185.160.137.162 |
| HTTPS | FAIL (no SNI) |
| Production | `127.0.0.1:3100` YES |
| Quick Tunnel | YES (ephemeral) |
| Rollback | previous `owl-web-1-backup-*` containers |

## 15. TEST_RESULTS

- `npx tsc -b` — PASS
- `npm test` (vitest) — **194 passed**
- `npx tsx scripts/drop-validation.mts` — **7/7 PASS**
- `npm run build` — PASS
- e2e smoke/controls/safety — **4/4 PASS** (autostart-safe helpers)
- e2e mobile + real-models — **12/13 PASS** (1 fail: Mobile Low on SwiftShader falls to SVG; not a real-phone result)
- Visual golden snapshots — not overwritten
- Production `:3100` — 200 `/` `/details` GLB; release `20260730-115319`
- Quick Tunnel smoke — PASS (ephemeral URL)

## 16. KNOWN_LIMITATIONS

1. Permanent HTTPS domain blocked (registrar / foreign openresty).
2. Videos not recorded under SwiftShader (see `videos/README.md`).
3. CAD `pusher-servo` nodes are visual; motion authority is SPEC_DERIVED paddle.
4. Real phone / Telegram WebView on device not exercised.
5. Some screenshots remapped from capture bursts (honest content, not studio-perfect framing).

## 17. DECISION

| Question | Answer |
|---|---|
| Same conveyor everywhere? | **YES** |
| Volumetric details? | **PARTIAL** (CAD solids + SPEC_DERIVED additions) |
| D435i correct? | **PASS** (SPEC_DERIVED) |
| Item stops under camera? | **NO** |
| Physical mechanism contact? | **PASS** |
| 7 routes 10/10? | **YES** |
| Domain works? | **BLOCKED** |
| Opens on phone? | **NOT_TESTED_ON_REAL_PHONE** |

## 18. FILES_CHANGED

Key additions/changes: `PusherMechanism.tsx`, `RealSenseD435i.tsx`, `pusherMotion.ts`,
`measurementZone.ts`, `physicsDropSim.ts`, `SorterPhysics.tsx` (physicsSimClock),
`PhysicalPlaybackItemPhysics.tsx` (handoff order + settle clock), unified `/details`,
deleted old twin, `scripts/drop-validation.mts`, `docs/stage2_real_sorter/*`, e2e autostart helpers.

## 19. FINAL_GIT_CHECK

Run at commit time:

```bash
git status --short
git diff --stat
git diff --check
git branch --show-current
git rev-parse HEAD
```
