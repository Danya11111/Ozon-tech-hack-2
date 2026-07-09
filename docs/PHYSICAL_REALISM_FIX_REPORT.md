# Physical Realism Fix Report

## Summary

Fixed physical realism issues in the 3D demo to ensure accurate representation of the sorting system.

## Problems Addressed

1. **Items displayed as colored cubes** - Items now load actual STL models with fallback to primitives
2. **Items sometimes above sensors** - Sensor rig height increased to 1.35m, always above max item height
3. **Items faster than conveyor** - Speed synchronized at 1 m/s
4. **C/D zones as flat platforms** - Replaced with realistic roll-cages (1.2×0.8×0.8m wireframe cages)
5. **HUD/Overlay overlap** - Repositioned: HUD top-right, CV overlay bottom-right with 16px+ gap
6. **Unrealistic sorting visuals** - Added chutes/deflectors for physical routing to C/D zones

## Root Causes

### Why Items Showed as Cubes
- `PlaybackItem` component was using primitive geometry instead of loading STL models
- `scaleFactor = 2.0` was applied, making items unnaturally large
- useLoader was being called conditionally, violating React hooks rules

### Solution
- Created separate `STLGeometry` component for proper hook usage
- `FallbackPrimitive` component for cases without STL models
- Removed scaleFactor, using true physical scale (1 unit = 1 meter)

## Changes Made

### physicalLayout.ts
- Added `MAX_ITEM_HEIGHT_M = 0.32` (320mm max normal item height)
- Added `OVERSIZE_DEMO_MAX_HEIGHT_M = 0.4` (400mm for oversized demo items)
- Added `SENSOR_CLEARANCE_M = 0.25` (250mm clearance above items)
- Added `SENSOR_RIG_HEIGHT_M = 1.35m` (above max item)
- Updated `CAMERA_RIG.cameraY = 1.35m` and `height = 1.5m`
- Updated `LASER_HEIGHT_M = 1.4m`
- Updated `STEREO_CAMERA.mountY = 1.35m`
- Added `ROLL_CAGE` dimensions (1.2×0.8×0.8m with 40mm wheels, 30mm frame)
- Added `getRenderedItemDimensions()` helper
- Set `ITEM_VISIBILITY_MULTIPLIER = 1.0` for true physical scale

### SorterDigitalTwinContinuous.tsx
- Replaced `STLItemModel` with `STLGeometry` and `FallbackPrimitive` components
- Removed `scaleFactor = 2.0`, using true dimensions in meters
- Added `RollCage` component for C/D zones with:
  - Wireframe metal frame
  - Caster wheels
  - Wire mesh sides
  - Color coding (C=orange, D=purple)
- Added `RouteChute` component for physical routing:
  - Angled chute surface from conveyor to cage
  - Side rails
  - Active state highlighting
- Updated `PlaybackItem` to use `getRenderedItemDimensions()` and `getItemYOnBelt()`

### styles.css
- CV overlay repositioned to `bottom: 100px` instead of `top: 50%`
- Added `max-height: calc(100vh - 280px)` with `overflow-y: auto`
- Mobile: compact bottom overlay with reduced font sizes
- Tablet: smaller overlay positioned below HUD
- Large screens: explicit gap from HUD

### Tests Added (physicalLayout.test.ts)
- Belt top at 0.7m
- Conveyor speed 1 m/s
- Max item height 0.32m
- Sensor rig above max item
- Camera rig above max item
- Roll cage dimensions 1.2×0.8×0.8m
- Item rendered height constraints
- Item center Y calculation
- Speed calculation verification
- Playlist categories map to valid commands

## Verification

### Build/Test Results
```
npm run build - SUCCESS
npm run test - 93 tests passed
docker compose up -d --build - SUCCESS
```

### Browser QA
- ✅ STL models load correctly (plate shows as flat cylinder)
- ✅ Items on belt at correct scale
- ✅ Sensors above items (1.35m vs max 1.1m item top)
- ✅ Speed synchronized at 1 m/s
- ✅ C/D roll-cages visible (orange/purple wireframe)
- ✅ Items route to C/D via chutes
- ✅ HUD and overlay don't overlap
- ✅ No console errors
- ✅ /details page not broken

## Screenshots

Location: `docs/physical_realism_fix_screenshots/`

- `real_stl_item.png` - STL model displayed
- `item_on_belt_scale.png` - Item at correct scale on belt
- `sensor_above_item.png` - Camera rig above item
- `speed_sync_t0.png` / `speed_sync_t1.png` - Speed verification
- `c_roll_cage.png` - Orange roll cage for C zone
- `d_roll_cage.png` - Purple roll cage for D zone
- `overlay_no_overlap.png` - HUD and overlay separated
- `mobile_overlay.png` - Mobile layout

## Physical Dimensions Summary

| Element | Dimension |
|---------|-----------|
| Conveyor belt top | 0.7m |
| Belt width | 0.5m |
| Belt speed | 1 m/s |
| Max item height (normal) | 0.32m |
| Max item height (oversize) | 0.4m |
| Sensor rig height | 1.35m |
| Camera/laser height | 1.35-1.4m |
| Roll cage | 1.2×0.8×0.8m |

## Commit Commands

```bash
git add -A
git commit -m "fix: physical realism for 3D demo

- Load STL models with fallback to primitives
- True physical scale (1 unit = 1 meter)
- Sensor rig at 1.35m above max item
- Roll-cages for C/D zones (1.2×0.8×0.8m)
- Chutes for physical routing
- HUD/overlay repositioned to avoid overlap
- Added physicalLayout tests"
git push origin dan_branch
```
