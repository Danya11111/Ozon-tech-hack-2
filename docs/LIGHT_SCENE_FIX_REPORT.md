# Light Scene Fix Report

**Date:** 2026-07-09  
**Status:** Fixed

---

## Problem

1. **Dark scene** — почти чёрный фон, плохая видимость
2. **"Лестница из труб"** — вращающийся артефакт на конвейере

---

## Root Cause: "Лестница из труб"

**Проблема в `ConveyorBelt` компоненте:**

```tsx
// БЫЛО — вся группа роликов вращалась вокруг Z:
<group ref={rollersRef}>
  {Array.from({ length: 18 }).map((_, i) => (
    <mesh key={i} position={[...]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[...]} />
    </mesh>
  ))}
</group>

useFrame(() => {
  rollersRef.current.rotation.z += delta; // ← ВСЯ ГРУППА вращалась!
});
```

Это создавало эффект "вращающейся лестницы" — все 18 роликов крутились вокруг общей оси Z.

**Исправление:**

```tsx
// СТАЛО — каждый ролик вращается отдельно вокруг своей оси X:
function Roller({ position, speedFactor }) {
  const meshRef = useRef<Mesh>(null);
  useFrame((_, delta) => {
    meshRef.current.rotation.x += delta * speedFactor * 3;
  });
  return <mesh ref={meshRef} rotation={[0, 0, Math.PI/2]} ... />;
}

// + добавлены animated stripes на ленте
function BeltStripe({ offset, speedFactor }) { ... }
```

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/ThreeD/SorterDigitalTwinContinuous.tsx` | Complete rewrite with light palette |
| `scripts/test_light_scene.py` | Browser QA script |

---

## Color Palette Changes

| Element | Before | After |
|---------|--------|-------|
| Background | `#0a1520` (dark) | `#f6f9ff` (light blue-white) |
| Floor | `#0f1a2a` (dark) | `#eaf2ff` (light blue) |
| Grid | `#2a4a6a` | `#c9d8ee` |
| Belt | `#1a2836` (dark) | `#7aa2d8` (medium blue) |
| Side guards | `#2a3d52` (dark) | `#9bb7d8` (light blue) |
| Rollers | `#3a5068` (dark) | `#b7c8dc` (light gray-blue) |
| Frame | — | `#d8e6f8` (very light blue) |

**Route colors (kept bright):**
- B: `#22c55e` (green)
- C: `#f97316` (orange)  
- D: `#8b5cf6` (purple)

---

## Lighting Changes

| Light | Before | After |
|-------|--------|-------|
| Ambient | 0.6 | 0.9 |
| Directional (main) | 1.0 | 1.2 |
| Directional (fill) | 0.3 | 0.5 |
| Hemisphere | 0.25 | 0.6 |

---

## Animation Changes

| Animation | Before | After |
|-----------|--------|-------|
| Rollers | Group rotation.z (broken) | Individual rotation.x (correct) |
| Belt motion | None | Moving stripes |
| Speed | N/A | ~1 m/s visual speed |

---

## Production Verification

```
curl -I https://arhipovdan.ru/       → 200 OK
curl -I https://arhipovdan.ru/details → 200 OK
```

**Browser QA:**
- ✓ Light background
- ✓ No dark scene
- ✓ No "ladder" artifact
- ✓ Conveyor reads as belt
- ✓ Item visible
- ✓ Play works
- ✓ HUD readable
- ✓ /details not broken
- ✓ No console errors

---

## Screenshots

```
docs/light_scene_screenshots/
├── light_idle.png
├── light_play_started.png
├── light_running_3s.png
└── light_route_active.png
```

### light_idle.png
- Light blue-white background
- Clean conveyor belt
- Zones A, B, C, D visible
- HUD readable on dark panel

### light_route_active.png
- Case 2/8 running
- Item visible (green for B)
- Gate bar colored by category
- Status updates in HUD

---

## Build/Test Results

```
✓ npm run build — success
✓ npm run test — 59 tests passed
✓ docker rebuild — success
✓ Production deployed
```

---

## What Remains

- Fine-tune roller rotation speed if needed
- Optional: add subtle shadow under items
- Optional: camera auto-follow during routing

---

## Commands for Commit/Push

```bash
cd /opt/arhipovdan/app

git add \
  src/components/ThreeD/SorterDigitalTwinContinuous.tsx \
  scripts/test_light_scene.py \
  docs/LIGHT_SCENE_FIX_REPORT.md \
  docs/light_scene_screenshots/

git commit -m "$(cat <<'EOF'
fix: light warehouse-style 3D scene, remove rotating ladder artifact

Root cause: ConveyorBelt used group.rotation.z which rotated all 18
rollers together, creating a "rotating ladder" visual artifact.

Fix:
- Each roller now rotates independently around its own X axis
- Added moving belt stripes for visual motion
- Changed dark palette (#0a1520) to light (#f6f9ff)
- Increased ambient/directional lighting
- Conveyor now looks like actual warehouse belt

Tested on https://arhipovdan.ru/ — light scene, no artifacts
EOF
)"

git push origin dan_branch
```

**DO NOT RUN** — commit/push not requested.
