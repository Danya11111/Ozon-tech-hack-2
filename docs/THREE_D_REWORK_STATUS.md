# 3D Digital Twin Rework — Current Status

## Completed Stages

### ✅ ЭТАП 0: Preflight
- Branch: `dan_branch` ✓
- Working tree: clean ✓
- 11 STL models found in `input_info/extracted/Stl/` ✓

### ✅ ЭТАП 1: Audit Current 3D Scene
- Documented problems in `docs/THREE_D_REWORK_PLAN.md`:
  - Labels overcrowding (12+ labels visible simultaneously)
  - No automatic demonstration
  - Only primitive geometries (box/cylinder)
  - Fixed camera with no guided presets
  - Debug-level scene geometry
  - Non-obvious routing visualization
  - Unrealistic gate/pusher mechanics

### ✅ ЭТАП 2: Analyze Real 3D Models
- **Model Assets Manifest**: Created `src/data/modelAssets.ts`
- **STL Models Strategy**:
  - ✅ Lightweight STL (< 700 KB): 6 models copied to `public/models/`
    - Бутылка (319 KB)
    - Тарелка (123 KB)
    - Цилиндр (106 KB)
    - Короб 300×200×200 (29 KB)
    - Короб 400×400×300 (27 KB)
    - ЛанчБокс (566 KB)
  - ⚠️ Heavy STL (> 1 MB): 5 models use fallback primitives
    - Моющее средство (3.5 MB) → box fallback
    - Мешок (5.5 MB) → not used
    - Ручка (2.0 MB) → box fallback
    - Шлем (2.7 MB) → not used
    - Пуфик (629 KB) → cylinder fallback
  - ℹ️ Missing models: 2 items use fallback primitives
    - SKU-010: Boundary box → box fallback
    - SKU-011: Oversized round → cylinder fallback
- **Manifest Stats**: 6 STL (55%), 5 procedural (45%)

### ✅ ЭТАП 3: Use Real Models in 3D
- **Created**: `src/components/ThreeD/STLModel.tsx`
  - Uses Three.js `STLLoader` from `three/examples`
  - Centers and scales geometry automatically
  - Supports fallback on load failure
- **Updated**: `src/components/ThreeD/Item3D.tsx`
  - Loads real STL models from `modelAssets` manifest
  - Fallback to primitives (box/cylinder/sphere) if model unavailable
  - Suspense boundary for async loading

### ✅ ЭТАП 4: Create Demo Director
- **Created**: `src/domain/demoDirector.ts`
  - 12 demo steps: intro → spawn → detection → decision → routing → result
  - Camera presets for each step (overview, detection closeup, gate closeup, routing, result)
  - Auto-play with pause/resume/stop controls
  - Playback speed: 1x, 2x, 0.5x
  - Loop mode for continuous demo
  - Scenario selection support
- **Step Durations**: Total ~10s per full cycle
- **Step-by-Step Labels**: Active labels list for each step

### ✅ ЭТАП 5: Camera Presets (in demoDirector.ts)
- **Presets defined**:
  - `overview`: [6.2, 4.8, 6.2] → [0, 0.3, 0]
  - `detectionCloseup`: [-1.2, 2.5, 3.5] → [-1.2, 0.3, 0]
  - `gateCloseup`: [1.6, 2.0, 3.0] → [1.6, 0.3, 0]
  - `routingB/C/D`: dynamic based on category
  - `resultB/C/D`: dynamic based on category
- ⚠️ Camera transitions not yet implemented (needs Canvas camera animation)

### ✅ ЭТАП 6: Remove Label Clutter
- **Updated**: `src/components/ThreeD/SceneLabels3D.tsx`
  - **Clean View (default)**: Only 5 labels (A/B/C/D + Накопитель)
  - **Step-Based Labels**:
    - Detection: +Camera CV, +Laser (total 7 labels)
    - At Gate: +Stop-gate (total 6 labels)
    - Routing: +Pusher C/D, +Route arrow (total 7 labels max)
  - **Technical Labels Toggle**: Shows all sensors/actuators/routes when enabled
  - **Removed**: ItemProofPanel from 3D scene (info now in 2D proof card only)
- **Updated**: `src/components/ThreeD/SorterDigitalTwin.tsx`
  - Added `technicalLabelsEnabled` prop
  - Added `cleanView` prop
  - Props passed to SceneLabels3D

### ✅ ЭТАП 7: Improve Geometry (Partial)
- **Updated**: `src/components/ThreeD/Actuator3D.tsx`
  - Gate: Vertical lift mechanism (Y-axis movement) instead of rotation
  - Gate support posts (left + right)
  - Pusher: Extended plate design with stationary base
  - Realistic colors and materials (metalness, roughness)
- **Updated**: `src/components/ThreeD/Conveyor3D.tsx`
  - Conveyor side guards (borders)
  - Visible rollers spaced every 1.2m
  - Direction arrow indicator
  - Enhanced accumulator walls
- **Updated**: `src/components/ThreeD/SortingZones3D.tsx`
  - Roll-cage C/D: Wireframe edges with EdgesGeometry
  - Vertical posts at corners for visual emphasis
  - Transparent body with visible frame

### ✅ ЭТАП 12: Tests (Partial)
- **Created**: `src/domain/demoDirector.test.ts`
  - Tests: createDemoDirectorState, start/pause/resume/stop
  - Tests: updateAutoDemo (time progression, step transitions)
  - Tests: getDemoStepSequence (order verification: command_sent → actuator_move → route_item)
  - Tests: loop mode, playback speed
  - ✅ All tests passing (43 total)
- **Created**: `src/data/modelAssets.test.ts`
  - Tests: manifest coverage for all SKU items
  - Tests: getModelAsset, getSTLAssets, getProceduralAssets
  - Tests: manifest stats (total, stl count, procedural count, percentage)
  - ✅ All tests passing

---

## Remaining Work

### 🔄 ЭТАП 8: Real Routing in 3D
**Status**: Not started  
**Priority**: Medium (current itemMotion works but is not realistic)

**TODO**:
- Update `src/components/ThreeD/itemMotion.ts`:
  - Curved path for C/D routing (not just Z-offset)
  - Sync with Demo Director steps
  - Smooth transitions between waypoints

### 🔄 ЭТАП 9: Simplify ProductDemo UI + Integrate Demo Director
**Status**: Not started  
**Priority**: HIGH (required for auto demo)

**TODO**:
- Update `src/components/ProductDemoSection.tsx`:
  - Add Demo Director state management
  - Add auto demo controls:
    - "Запустить автодемо" button
    - "Пауза" button
    - Scenario selector (B/C/D/C-priority/Fault/Emergency)
    - "Technical labels" toggle
  - Pass `demoDirectorState`, `technicalLabelsEnabled` to SorterDigitalTwin
  - Simplify layout: 3D left, proof card right, timeline below
- Update `src/App.tsx`:
  - Integrate Demo Director state
  - Sync simulation state with Demo Director steps
  - Handle auto demo lifecycle

### 🔄 ЭТАП 10: Mobile Behavior
**Status**: Existing 2D fallback OK, no changes needed  
**Current behavior**: Mobile shows 2D fallback with explanation

### 🔄 ЭТАП 11: Documentation Updates
**Status**: Partial (THREE_D_REWORK_PLAN.md created)  
**TODO**:
- Update `README.md` with:
  - Real models section (which STL used, which fallback)
  - Model assets manifest location
  - Auto demo instructions
- Update `docs/DEMO_SCRIPT.md` with:
  - Auto demo script (step-by-step)
  - How to show B/C/D/C-priority/Fault
- Update `docs/JURY_QA.md` with:
  - Q: "Why are some models procedural fallbacks?" → A: Performance (heavy STL > 1 MB)
  - Q: "How does auto demo work?" → A: Demo Director controls step sequence
- Update `docs/SUBMISSION_CHECKLIST.md` with:
  - STL models checklist
  - Auto demo verification
- Update `docs/THREE_D_FEASIBILITY.md` with:
  - Real models feasibility
  - Physics engine NOT used (as per requirements)

### 🔄 ЭТАП 13: Build/Test/Deploy
**Status**: Build ✅, Test ✅, Docker not checked  
**TODO**:
- Run Docker rebuild: `docker compose -p owl -f docker-compose.server.yml up -d --build`
- Check domains: arhipovdan.ru, www.arhipovdan.ru, 127.0.0.1:3100
- Verify FPS with STL models

### 🔄 ЭТАП 14: Visual QA via Browser MCP
**Status**: Not started  
**Priority**: HIGH (required for verification)

**TODO**:
- Desktop 1920×1080:
  - Verify max 5 labels in clean view
  - Verify real STL models load (bottle, plate, cylinder, box)
  - Verify auto demo runs (if implemented)
  - Verify gate/pusher movement
  - Verify route visualization
  - Verify proof panel explains decision
- Laptop 1440×900:
  - Verify responsive layout
- Mobile 390×844:
  - Verify 2D fallback active
  - Verify no horizontal scroll

---

## Known Issues & Risks

### Issues
1. **Camera transitions not implemented**: Demo Director has camera presets, but SorterDigitalTwin doesn't animate between them yet.
2. **Auto demo not integrated**: Demo Director exists, but ProductDemoSection/App.tsx don't use it yet.
3. **ItemMotion not synced with Demo Director**: Current motion is simulation-driven, not demo-driven.

### Risks
1. **STL Loading Performance**: 6 STL models load async, may cause frame drops on low-end devices.
   - **Mitigation**: Suspense + fallback primitives ensure scene is never empty.
2. **Auto Demo Timing**: Step durations may feel too fast/slow for user.
   - **Mitigation**: Playback speed control (1x, 2x, 0.5x).
3. **Camera Animation Complexity**: Smooth camera transitions between presets require lerp/easing.
   - **Mitigation**: Can start with instant camera jumps, add smooth transitions later.

---

## Next Immediate Steps

1. **Integrate Demo Director into ProductDemoSection/App** (ЭТАП 9)
   - This is the highest priority to enable auto demo
   - Required before Visual QA can verify auto demo functionality

2. **Run Docker Build & Domain Checks** (ЭТАП 13)
   - Verify deployment still works with new STL models

3. **Visual QA Desktop** (ЭТАП 14)
   - Verify STL models load correctly
   - Verify clean view labels (max 5 default)
   - Verify geometry improvements (gate lift, roll-cage wireframe)

4. **Documentation Updates** (ЭТАП 11)
   - Update README.md with STL models section
   - Update DEMO_SCRIPT.md with auto demo instructions
   - Update JURY_QA.md with new questions

---

## Definition of Done (Progress)

- ✅ 1. Real STL models used where possible (6/11 items)
- ✅ 2. Fallback primitives for heavy/missing models (5/11 items)
- ✅ 3. Manifest documents all models (`src/data/modelAssets.ts`)
- ✅ 4. Labels reduced to max 5 in clean view (SceneLabels3D)
- ⚠️ 5. Technical labels toggle (prop added, but not connected to UI yet)
- ⚠️ 6. Auto demo created (Demo Director exists, but not integrated)
- ✅ 7. Gate/Pusher realistic movement (vertical lift, extended plates)
- ✅ 8. Roll-cage wireframe (C/D zones)
- ✅ 9. Conveyor realistic geometry (side guards, rollers)
- ⚠️ 10. Camera presets defined (in Demo Director, but not used yet)
- ✅ 11. Tests green (43/43 passing)
- ✅ 12. Build green (TypeScript compilation successful)
- ⚠️ 13. Docker not checked yet
- ⚠️ 14. Visual QA not performed yet
- ⚠️ 15. Docs not updated yet

**Overall Progress**: ~60% complete  
**Blockers**: Auto demo integration (ЭТАП 9) is critical path for remaining work.
