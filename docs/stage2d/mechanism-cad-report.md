# Mechanism CAD report — SPEC_DERIVED_CAD

## Status

`SPEC_DERIVED_CAD` — **not** original author FreeCAD.

## Origin of dimensions

1. `src/domain/pusherMotion.ts` — paddle half-extents, stroke, yaw, engage point
2. `docs/stage2_real_sorter/mechanism-map.md` — pneumatic angled paddle class
3. Prior Stage 2B visual housing sizes (servo Ø90×160 mm)

## Geometry (mm)

| Part | Size |
|---|---|
| Paddle plate | 1000 × 280 × 50 |
| Leading edge | 1000 × 280 × 4 |
| Servo body | Ø90 × 160 |
| Shaft | Ø20 × 60 |
| Bracket / housing | documented in params JSON |
| Axis height above belt | 142 |
| Stroke | 1620 |
| Yaw | ≈20.4° |

## Files

- `3d_models/sorter_mechanism.step`
- `3d_models/sorter_mechanism.params.json`
- `public/models/sorter/mechanism-web.glb` (~244 tris)
- Pivot: plate center = Rapier body origin (matches collider)

## Runtime

`PusherMechanism` loads GLB; collider remains domain cuboid for headless parity.
JSX mesh is Suspense fallback only.
