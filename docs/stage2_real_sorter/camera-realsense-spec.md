# Intel RealSense D435i — Spec-Derived Model & Mount

## Source of truth

No official CAD file is distributed by Intel for the D435i housing in a web-usable
license; the model is `SPEC_DERIVED` from the published datasheet dimensions and
product photography (Intel RealSense D435i datasheet, §Mechanical).

| Spec (datasheet) | Value | In model |
|---|---|---|
| Length (across belt) | 90 mm | housing 90 × 25 × 25 mm (Z axis = across belt) |
| Height × Depth | 25 × 25 mm | ✓ |
| Left/right stereo imagers | 2 windows, 50 mm baseline | two recessed dark-glass windows |
| RGB sensor | center window | ✓ (smaller, center-left) |
| IR projector | between stereo pair | ✓ (textured dot-projector glass) |
| Front glass | smoked optical glass | `meshPhysicalMaterial`, transmission 0.35, roughness 0.05 |
| Housing | anodized aluminum, dark gray | metalness 0.9, roughness 0.45 |
| Mounting | 1/4″-20 tripod boss (bottom) + M3 | tripod boss under housing; U-bracket to gantry |
| Interface | USB-C | modeled port on back face |

Component: `src/components/ThreeD/RealSenseD435i.tsx` (`RealSenseD435i`, plus
`RealSenseFrustumDebug` overlays). Constants: `D435I` (dimensions).

## Mounting (physical)

- Gantry cross-bar above the belt at the measurement station, x = −0.35..0.45 m
  (straddles scan center x = 0.05).
- U-bracket drops from the cross-bar; camera hung lens-down.
- Optical axis: vertical, −Y (front glass faces the belt).
- Optical height above belt surface: **0.65 m** (within the D435i depth range
  0.2–10 m; gives a 0.72 m × 0.55 m footprint, see below).
- Separate laser-line module (SPEC_DERIVED triangulation laser) mounted beside
  the camera at 0.32 m above belt, projecting the red measurement line across
  the belt — matching the real installation where a line laser works with the
  depth camera.

## Measurement zone geometry (drives `measurementZone.ts`)

- D435i depth FOV: 87° × 58° (H × V). At h = 0.65 m:
  - across-belt footprint: 2·h·tan(43.5°) ≈ 1.23 m (covers full 0.5 m belt width);
  - along-belt footprint: 2·h·tan(29°) ≈ **0.72 m** → `SCAN_START_X = −0.31`,
    `SCAN_END_X = 0.41` around camera x = 0.05.
- Item at 1.0 m/s crosses the scan window in ~0.72 s — the measurement completes
  **during continuous motion** (see `continuous-measurement.md`).

## Debug overlays (`?debug=1&physics=1`)

`RealSenseFrustumDebug` renders: optical axis ray, FOV pyramid (wireframe),
measurement-zone rectangle on the belt, entry/exit markers. Screenshot:
`screenshots/06-measurement-frustum-debug.png`.
