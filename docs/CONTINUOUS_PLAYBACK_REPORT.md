# Continuous Playback Report

**Date:** 2026-07-09  
**Status:** Implemented

---

## What Was Implemented

### 1. Continuous Playback Engine (`src/domain/continuousPlayback.ts`)

New state machine for managing 8-case auto-demo:

- `PlaybackStatus`: idle | running | paused | finished
- `CasePhase`: spawn → move_to_detection → detection → measurement → classification → command_sent → routing → exit → clear_gap
- Auto-advance from case to case
- Loop mode (optional)
- Phase-by-phase timing based on conveyor speed (1 m/s)

### 2. Conveyor Path Calculator (`src/domain/conveyorPath.ts`)

Physics-accurate item positioning:

- Real-world scale: 1 unit = 1 meter
- Conveyor speed: 1 m/s
- Item position calculated from phase and progress
- Supports lateral movement for C/D routing

### 3. Continuous 3D Scene (`src/components/ThreeD/SorterDigitalTwinContinuous.tsx`)

Dedicated 3D component for main page:

- Animated conveyor belt
- Zone markers (A, B, C, D)
- Detection zone with scan visualization
- Gate/accumulator
- Route arrows (highlighting active route)
- Animated item following conveyor path

### 4. Updated Main Page (`src/pages/MainPage.tsx`)

New props interface using `ContinuousPlaybackState`:

- HUD shows: item, status, category, command, speed, warning
- Case progress bar
- Playlist progress dots (8 dots)
- Play/Pause/Stop controls
- Finished overlay with replay option

### 5. Updated App State (`src/App.tsx`)

Separate playback loop for main page:

- `playback` state using `ContinuousPlaybackState`
- RAF-based update loop at 50ms intervals
- Independent from details page simulation

---

## How 8-Case Playback Works

### Playlist Order

| # | ID | Item | Category | Demonstrates |
|---|---|------|----------|--------------|
| 1 | box_b | Короб 300×200×200 | B | Normal box passes |
| 2 | lunchbox_b | ЛанчБокс | B | Compact item passes |
| 3 | oversized_box_c | Негабаритный короб | C | Dimensions FAIL |
| 4 | small_item_c | Ручка | C | Min dimensions FAIL |
| 5 | plate_d | Тарелка | D | Roundness K≥0.7 |
| 6 | bottle_d | Бутылка | D | Cylinder roundness |
| 7 | c_priority | Негабарит + круглый | C | C priority over D |
| 8 | low_confidence | Low confidence | B | Warning + fallback |

### Timeline Per Case (~6.3 seconds)

| Phase | Duration | Description |
|-------|----------|-------------|
| spawn | 500ms | Item appears at zone A |
| move_to_detection | 1200ms | Item moves to camera |
| detection | 600ms | CV detection active |
| measurement | 400ms | Laser measurement |
| classification | 500ms | Rule-based classification |
| command_sent | 300ms | ROUTE_TO_* command |
| routing | 1500ms | Item routes to zone |
| exit | 800ms | Item exits to target |
| clear_gap | 500ms | Prepare for next item |

**Total per case:** ~6.3 seconds  
**Total for 8 cases:** ~50 seconds

### Playback Flow

1. User clicks **Play Demo**
2. Playback starts at case 1 (box_b)
3. Item spawns at A, moves along conveyor
4. Detection → Classification → Command → Routing
5. Item exits to target zone (B/C/D)
6. After clear_gap, case 2 starts automatically
7. Continues through all 8 cases
8. After case 8: status = "finished"
9. User can click **Replay** to start over

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `src/domain/continuousPlayback.ts` | Playback engine |
| `src/domain/continuousPlayback.test.ts` | Unit tests (16 tests) |
| `src/domain/conveyorPath.ts` | Item position calculator |
| `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | 3D scene for main page |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Added playback state and handlers |
| `src/pages/MainPage.tsx` | Updated to use ContinuousPlaybackState |
| `src/styles.css` | Added styles for progress bar, warnings, finished overlay |

### Unchanged

- `src/pages/DetailsPage.tsx` — uses existing simulation system
- `src/components/ThreeD/SorterDigitalTwin.tsx` — unchanged
- All existing components in DetailsPage

---

## Screenshots Location

Screenshots should be placed in:

```
docs/continuous_playback_screenshots/
├── case1_start.png
├── case1_detection.png
├── case1_routing.png
├── case2_started.png
└── case8_or_finished.png
```

**Note:** Screenshots require manual browser capture.

---

## What Was Verified

### Build

```
✓ npm run build — success
```

### Tests

```
✓ 59 tests passed (8 test files)
✓ 16 new tests for continuous playback
```

### New Tests Added

1. `demoPlaylist has exactly 8 cases`
2. `demoPlaylist has no duplicate case ids`
3. `demoPlaylist has no mixed category`
4. `all commands would be ROUTE_TO_B/C/D`
5. `low_confidence case has warning but final category is B/C/D`
6. `has correct case order: B, B, C, C, D, D, C, B`
7. `creates initial state with idle status`
8. `startPlayback sets status to running`
9. `pausePlayback sets status to paused`
10. `resumePlayback sets status back to running`
11. `stopPlayback resets to idle`
12. `advances from case 1 to case 2 after case duration`
13. `status becomes finished after case 8 (without loop)`
14. `loops back to case 1 after case 8 with loopMode`
15. `updates command during routing phase`
16. `does not update when paused`

---

## What Remains

### Ready for Testing

- [ ] Browser QA: Play → 8 cases → finished
- [ ] Verify item visually moves
- [ ] Verify route highlights
- [ ] Verify HUD updates
- [ ] Capture screenshots

### Future Enhancements (Not in scope)

- Camera transitions between phases
- Speed control (0.5x, 1x, 2x)
- Skip to specific case
- Sound effects

---

## Commands for Manual Commit/Push

```bash
cd /opt/arhipovdan/app

git add \
  src/domain/continuousPlayback.ts \
  src/domain/continuousPlayback.test.ts \
  src/domain/conveyorPath.ts \
  src/components/ThreeD/SorterDigitalTwinContinuous.tsx \
  src/App.tsx \
  src/pages/MainPage.tsx \
  src/styles.css \
  docs/CONTINUOUS_PLAYBACK_REPORT.md \
  docs/continuous_playback_screenshots/

git commit -m "$(cat <<'EOF'
feat: implement continuous 8-case playback engine for main page

- Add continuousPlayback.ts with phase-based state machine
- Add conveyorPath.ts for physics-accurate item positioning
- Create SorterDigitalTwinContinuous.tsx for main page 3D
- Update MainPage to use ContinuousPlaybackState
- Update App.tsx with playback loop (50ms intervals)
- Add 16 unit tests for playback logic
- Add styles for progress bar, warnings, finished overlay

Playback flow: spawn → detection → classification → routing → exit
Total duration: ~50 seconds for all 8 cases
EOF
)"

git push origin dan_branch
```

**DO NOT RUN** — commit/push not requested.
