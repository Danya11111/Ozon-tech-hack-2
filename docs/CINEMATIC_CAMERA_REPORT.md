# Cinematic Camera Report

## Summary

Added cinematic camera playback system that automatically transitions between camera angles during the 8-case demo, creating a video-like experience.

## Camera Modes Implemented

| Mode | Phase(s) | Description |
|------|----------|-------------|
| `feedCloseup` | spawn | Close-up view of item appearing on belt at zone A |
| `overview` | move_to_detection | Wide view following item along conveyor |
| `inspectionTop` | detection | Top-down view showing camera rig and inspection zone |
| `measurementSide` | measurement | Side view showing laser beam and item height |
| `classificationTop` | classification | Top view for shape analysis visualization |
| `routingWide` | command_sent | Wide view showing entire routing area |
| `chuteCloseup` | routing | Close-up of chute/deflector and item routing |
| `resultZone` | exit | View of destination zone (B/C/D roll-cage) |
| `nextItemReset` | clear_gap | Reset view preparing for next item |

## How Camera Follows Item

1. **Target following**: During movement phases (`move_to_detection`, `routing`, `exit`), camera target partially follows item position with configurable weight (0.3-0.5)

2. **Smooth transitions**: Uses lerp (linear interpolation) with smoothing factor of 0.04 for gradual transitions between camera positions, targets, and FOV

3. **Category-aware routing**: Camera adjusts view based on target category:
   - B: Main conveyor line view
   - C: Rotates toward positive Z (orange roll-cage)
   - D: Rotates toward negative Z (purple roll-cage)

4. **Viewport adaptation**: Camera positions adjusted for screen size:
   - Desktop: Standard positions
   - Laptop: 15% higher, 10% further back
   - Mobile: 30% higher, 25% further back, +8° FOV

## Files Created/Modified

### Created
- `src/domain/cinematicCamera.ts` - Camera director logic
- `src/domain/cinematicCamera.test.ts` - Unit tests (20 tests)
- `scripts/test_cinematic_camera.py` - Browser QA script

### Modified
- `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` - Added:
  - `CinematicCameraController` component
  - `MotionTrail` component for movement feedback
  - Integration with OrbitControls (disabled during cinematic mode)
- `src/pages/MainPage.tsx` - Added:
  - Auto camera toggle button
  - Viewport type detection
  - Props passing to 3D component
- `src/styles.css` - Added `.auto-camera-toggle` styles

## Features

### Auto Camera Toggle
- Button in bottom-left corner: "AUTO CAM: ON/OFF"
- When ON: Cinematic camera active during playback
- When OFF: Manual OrbitControls enabled
- Toggle persists during session

### Motion Trail
- Subtle visual trail behind moving items
- Shows during `move_to_detection`, `routing`, `exit` phases
- Direction matches item movement (X for main belt, Z for C/D routing)
- Color matches target category

### Viewport Adaptations
- Desktop (≥1200px): Full cinematic experience
- Laptop (768-1199px): Higher/wider camera, no overlay collision
- Mobile (<768px): Fallback or simplified view, compact overlay

## Phase Coverage

All 9 playback phases have associated camera modes:
- ✅ spawn → feedCloseup
- ✅ move_to_detection → overview  
- ✅ detection → inspectionTop
- ✅ measurement → measurementSide
- ✅ classification → classificationTop
- ✅ command_sent → routingWide
- ✅ routing → chuteCloseup
- ✅ exit → resultZone
- ✅ clear_gap → nextItemReset

## Screenshots

Location: `docs/cinematic_camera_screenshots/`

- `overview.png` - Initial overview
- `feed_closeup.png` - Item spawn close-up
- `inspection_top.png` - Detection from above
- `measurement_side.png` - Side measurement view
- `routing_wide.png` - Wide routing view
- `chute_closeup.png` - Chute close-up
- `result_zone.png` - Exit to destination
- `c_routing.png` - C-zone routing
- `d_routing.png` - D-zone routing
- `mobile_view.png` - Mobile layout

## Test Results

```
npm run build - SUCCESS
npm run test - 113 tests passed (11 test files)
  - cinematicCamera.test.ts: 20 tests
docker compose up -d --build - SUCCESS
Browser QA - No console errors
```

## Limitations

1. **Mobile WebGL**: In headless browser testing, mobile shows fallback due to WebGL not available. Real mobile browsers with WebGL will show the 3D scene.

2. **Camera shake**: Very fast movements may show minor camera jitter. Smoothing factor (0.04) balances responsiveness vs stability.

3. **Manual control resume**: After pausing and manually rotating camera, resuming playback snaps back to cinematic angle.

## Commit Commands

```bash
git add -A
git commit -m "feat: cinematic camera playback for 3D demo

- Add cinematicCamera.ts with 9 camera modes
- Smooth camera transitions with lerp
- Camera follows item during movement
- Category-aware routing views (B/C/D)
- Viewport adaptation (desktop/laptop/mobile)
- Motion trail for movement feedback
- Auto camera toggle button
- 20 unit tests for camera logic"
git push origin dan_branch
```
