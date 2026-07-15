# Twin Geometry Alignment

## Goal

Keep `/` (continuous twin) and `/details` (state-machine twin) as projections of one sorter layout — same belt height, zone X/Z, sensors, gate, and category colors — without rewriting both scenes or enabling a physics engine.

## What was unified

| Concern | Source of truth | Consumers |
| --- | --- | --- |
| Conveyor dims, `BELT_TOP_Y` (0.7 m), zones A/B/C/D, gate, roll cages | `src/domain/physicalLayout.ts` | Continuous twin, `conveyorNetwork`, cameras |
| Shared bridge + details-derived layout | `src/domain/layout/sharedLayout.ts` | Details `TWIN_LAYOUT`, route/color tokens |
| Category / route colors | `src/domain/industrialTheme.ts` → `CATEGORY_COLORS` | Both twins, details `ROUTE_COLORS` |
| Class route directions (B→+X, C→+Z, D→−Z) | `CLASS_ROUTE_DIRECTIONS` in `sharedLayout` | Documentation / consistency |

### Details twin derivation

`itemMotion.ts` no longer hardcodes a compact layout (`beltY: 0.35`, divergent X). It exports:

```ts
TWIN_LAYOUT = DETAILS_TWIN_LAYOUT  // from sharedLayout
ROUTE_COLORS = CATEGORY_COLORS
PHYSICS_ENGINE_ENABLED = false
```

Aligned meters (vs previous details values):

- `beltY` → `BELT_TOP_Y` (0.7)
- `startX` / `zoneBX` / `zoneCZ` / `zoneDZ` → `ZONES.A/B/C/D`
- `cameraX` / `laserX` / `gateX` → `ZONES.CAMERA/LASER/GATE`
- `rollCageSize` → `ROLL_CAGE`
- Progress keyframes (`progressForState`) unchanged — only absolute meters moved

Details scene helpers (conveyor materials, zone pads, sensor poles, label Y) use `TWIN_LAYOUT.beltY` or `INDUSTRIAL_PALETTE` so the presentation layer tracks the shared height.

### Consistency test

`src/domain/routeConsistency.test.ts` asserts for each non-fault `DEMO_PLAYLIST` case:

1. `classifyItem` category === `expectedCategory`
2. Continuous playback `targetCategory` matches after seek
3. `CATEGORY_COLORS` has an entry for that category
4. `getPhysicalItemPose` at mid-routing has `activeRoute` === category and `phase === 'routing'`

## Intentional differences (keep)

| Continuous (`/`) | Details (`/details`) |
| --- | --- |
| Engineering HUD: measurement, events, physical surfaces from `conveyorNetwork` | Presentation / teaching twin: state-machine progress keyframes |
| Deterministic `getPhysicalItemPose` along network surfaces | `itemPosition3D` progress along a simplified X (and Z for C/D) |
| Light industrial floor / grid (`INDUSTRIAL_PALETTE` light) | Dark engineering projection of the same palette |
| Full B receiver spur + chutes + cage floors | Simplified zone boxes + roll-cage visuals |
| Ultrasonic not a separate continuous station | Details-only `ultrasonicX` between laser and gate |
| Cinematic camera / playlist director | OrbitControls + machine-state HUD chips |

Motion remains **state-machine / kinematic** only (`PHYSICS_ENGINE_ENABLED === false`). Do not enable a physics engine for alignment.

## How to extend

1. Change geometry in `physicalLayout.ts` (or zone map there).
2. Re-export / map in `layout/sharedLayout.ts` if details needs a new derived field.
3. Keep details keyframe ratios in `itemMotion.ts` unless timing intentionally changes.
4. Prefer `INDUSTRIAL_PALETTE` / `CATEGORY_COLORS` for new materials.
