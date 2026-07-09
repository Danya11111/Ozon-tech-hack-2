# OZON Final Fix — Production Diagnosis (Before)

**Date:** 2026-07-09  
**Branch:** `dan_branch`  
**Production URL:** https://arhipovdan.ru/  
**Evidence:** `docs/ozon_final_fix_evidence/before/`

---

## 1. What was actually visible on production (before fix)

### Video
- `before_full_play.webm` — full Play cycle (~80 s), 8 cases.

### Screenshots
| File | Observation |
|------|-------------|
| `01_idle.png` | Idle state OK, hero + 3D canvas load. |
| `02_b_item_problem.png` | Case 1 B routing starts; item on main belt. |
| `05_item_stopped_on_conveyor.png` | **P0:** B lunchbox (case 2) sits on long green transfer deck at belt height — looks like active conveyor, not inside a floor bin. |
| `04_b_no_real_bin.png` | B zone reads as belt extension + low tray; no distinct industrial receiving container on the floor. |
| `03_lag_or_console.png` | Visible stutter during multi-item playback; HUD updates but motion not fluid. |
| `06_console.png` / `06_console.json` | See console section below. |

### Console (Playwright capture, 5 s after Play)
```
errors: 0
log_spam (console.log): 0
warnings: 5
```
Warnings were **not from app code**:
- `THREE.Clock: deprecated` (three.js / R3F)
- `GPU stall due to ReadPixels` (Playwright screenshot GPU readback)

**No `console.log` from `src/`.** `console.error` only in error boundaries.

### Lag / stutter
- Visible frame drops when 3+ items on screen with STL meshes.
- Auto-cinematic camera + PointCloud + ScanLine + MotionTrail active on desktop.
- Belt ran to `CONVEYOR_END_X = 3.85` — visually merged B transfer with main line.

### B item routing
- Motion model had `b_receiver_floor` but 3D scene drew a **long green transfer deck** (1.5 → 3.6 m).
- B item settled pose was correct in unit tests but **visually appeared on the spur** because:
  1. Transfer deck looked identical to belt.
  2. Settle happened late (near exit phase).
  3. Cinematic camera followed **current** case, hiding settled B in bin during screenshots.

### B physical bin
- **No separate floor-standing bin** with walls, legs, and drop chute.
- B read as “tray on conveyor end”, not OZON-level receiving zone.

### C/D receivers
- Roll cages present on floor with visible floors.
- C/D routing generally worked in motion model; containment OK in tests.
- Multiple STL items + effects caused lag before C/D cases finished.

### Render load (code audit)
| Item | Before |
|------|--------|
| `MAX_VISIBLE_ITEMS` | 8 |
| Simultaneous STL | Up to 8 heavy STLs |
| `useFrame` hooks (continuous scene) | 6 (CinematicCamera, PointCloud, ScanLine, Stepper pulse, etc.) |
| Rollers | Static (already fixed prior pass) |
| Shadows | `shadows={false}` on Canvas |
| Heavy effects default | ON on desktop (`!liteScene`) |

---

## 2. What did NOT meet OZON-level demo bar

1. **B receiver not physically readable** — item on belt spur, not in floor bin.
2. **Performance** — stutter with effects + many STLs.
3. **Visual sorting story broken** — viewer cannot see A → inspection → junction → **distinct** B/C/D containers in one glance.
4. **Proof gap** — prior “готово” reports without production video.

---

## 3. Root causes (code)

| Symptom | Root cause | File(s) |
|---------|------------|---------|
| B on belt | Long `b_transfer` surface + transfer deck mesh = belt extension; late settle timing | `physicalLayout.ts`, `conveyorNetwork.ts`, `physicalItemMotion.ts`, `SorterDigitalTwinContinuous.tsx` |
| No real B bin | `BReceiverBin` was floor pad + walls but dominated by 2+ m transfer deck | `SorterDigitalTwinContinuous.tsx` |
| Lag | `MAX_VISIBLE_ITEMS=8`, all items load STL; PointCloud/ScanLine/MotionTrail/CinematicCamera active | `SorterDigitalTwinContinuous.tsx`, `PhysicalPlaybackItem.tsx` |
| Console noise | No app `console.log`; only THREE deprecation + Playwright GPU warnings | N/A (acceptable) |
| setState in useFrame | None found; camera uses ref + direct Three.js mutation | `SorterDigitalTwinContinuous.tsx` |

---

## 4. Acceptance criteria for fix (reference)

- B: `main_belt → inspection → junction → b_transfer → chute_b → b_bin_floor → settled`
- `MAX_VISIBLE_ITEMS ≤ 6`
- `ENABLE_DEMO_EFFECTS = false` by default
- Settled items: simplified mesh, neutral material
- Production video + screenshots after deploy
