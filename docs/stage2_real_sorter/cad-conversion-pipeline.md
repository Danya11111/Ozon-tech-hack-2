# CAD → WebGL Conversion Pipeline

## Input

- `assets/cad/*.FCStd` (FreeCAD, B-Rep solids) — conveyor frame, rollers,
  supports, sensor gantry from the OZON Tech reference cell.
- `public/models/*.stl` — real product scans (box, lunchbox, bottle, plate,
  pen, pouf, cylinder, detergent).

## Pipeline (reproducible)

1. **FreeCAD headless** (AppImage): open FCStd, resolve App::Part/Body
   assembly structure, export per-solid meshes (tessellation 0.1 mm linear /
   0.5° angular deflection).
2. **Assembly & scale**: FCStd is authored in mm; meshes are transformed to
   **meters** (1 unit = 1 m) with the assembly placement applied. Verified:
   conveyor GLB bounding box matches the 5.5 m × 0.7 m × 0.5 m machine
   envelope; belt width = 500 mm exactly.
3. **Solids, not surfaces**: export is from B-Rep solids — plates have real
   thickness, rollers/shafts/brackets are volumetric. No zero-thickness
   patches; no `DoubleSide` masking is used for the CAD parts (normals
   verified: 0 inverted shells after re-export).
4. **GLB packaging**: single `conveyor-web.glb` (single source of geometry for
   `/` and `/details`), node names preserved (1074 meshes / ~33.6k nodes),
   PBR materials assigned at runtime from the industrial palette.
5. **Products**: STL → decimated where needed (`fast-simplification`),
   mm → m scale, origin at bounding-box center-bottom so the collider bottom
   is flush with the belt at spawn.

## Single source of truth (§4)

`SorterDigitalTwinContinuous.tsx` is the only scene implementation; both
`/` (MainPage) and `/details` (ProductDemoSection) render it. The legacy
parallel implementation (`SorterDigitalTwin.tsx`, `Conveyor3D.tsx`,
`Actuator3D.tsx`, `SensorRig3D.tsx`, `SortingZones3D.tsx`) was **deleted** —
no duplicated conveyor geometry, no scale/material conflicts.

## SPEC_DERIVED additions (non-CAD elements)

Elements absent from the CAD set are built from drawings/specs, tagged
SPEC_DERIVED: RealSense D435i + gantry brackets (see
`camera-realsense-spec.md`), angled paddle diverters (`mechanism-map.md`),
chute transfer plate/rails, rolltainers B/C/D, line-laser module.
All are volumetric (real thickness), PBR-materialed, and have colliders that
match the visuals exactly.

## Inventory

See `cad-inventory.json` for the node/material/dimension audit of
`conveyor-web.glb` and each product mesh.
