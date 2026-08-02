# Engineering notes (canonical)

Companion to `README.md` and `/documentation`. Not a stage changelog.

## Coordinate conventions

- World units: **1 unit = 1 meter**.
- Belt travel primarily along **+X**; belt top Y ≈ **0.70 m**.
- Lateral: **+Z** = physical LEFT (category C), **−Z** = physical RIGHT (category D).
- Sorter CAD module origin X = `0`; camera module `−2.01`; clean module `−4.02`.
- Longitudinal plane S for diverter timing is world X along the sorter module.

## Canonical constants (code)

| Symbol | Value | File |
|---|---|---|
| `DIVERTER_LEFT_SIGNED_DEG` | −45 | `src/domain/pusherMotion.ts` |
| `DIVERTER_RIGHT_SIGNED_DEG` | +45 | same |
| `rotationDurationSec()` | 0.50 | same (45° / 90°/s) |
| `OPENING_SAFETY_MARGIN_SEC` | 0.15 | same |
| Contact / clear planes | ≈1.0538 / 1.6000 | `buildDiverterPlanes` + mount hinge |
| Classifier min/max | exclusive 10³ / 450×320×320 | `src/domain/classifier.ts` |
| Roundness | K > 0.8 | same |
| `CONVEYOR_CAD_URL` | `/models/sorter/conveyor-clean.glb` | `ConveyorCadModel.tsx` |

## Active source tree (runtime)

```
src/main.tsx
src/App.tsx
src/pages/{MainPage,DocumentationPage}.tsx
src/components/{AppNav,SorterScene,CVInspectionOverlay,BuildIdentityBadge}.tsx
src/components/ThreeD/* (active twin only)
src/domain/* (classifier, playback, layout, diverter, physics helpers)
src/data/{items,modelAssets,resolveItem,productionStatusSummary,demoPlaylist,scenarios}.ts
src/styles.css
```

## Asset provenance

| Role | Path |
|---|---|
| Author CAD | `3d_models/conveer.FCStd` |
| Runtime conveyor | `public/models/sorter/conveyor-clean.glb` |
| Products | `public/models/*.stl` from official STL ZIP |
| Classifier PDF | `official_sources/doc-1783095831.pdf` |
| Workspace / scoring PDFs | `input_info/doc-1783009942.pdf`, `doc-1783011400.pdf` |

## Physics roadmap (not completed)

1. Surface-velocity belt at 1 m/s with visual loop.
2. Contact-validated CAD diverter deflection for all playlist SKUs.
3. Calibrated per-SKU mass, COM, friction, damping.
4. Receiver capture verification under dynamic drops.

CCD for light/thin items exists in runtime/sim; that alone is **not** full contact validation.

## Compliance evidence rules

- Prefer present official files under `input_info/` and `official_sources/doc-1783095831.pdf`.
- Missing: `input_info/extracted/Постановка_Задача_3_сжато_2.pdf` — never claim it is available.
- Internal engineering criteria are not automatic Ozon pass/fail.

## Layout drawing

`docs/engineering/work-area-layout-source.png` — workspace layout provenance image retained for engineering reference.
