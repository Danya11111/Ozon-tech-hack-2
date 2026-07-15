/**
 * Shared twin geometry — single source of truth for continuous (`/`) and details (`/details`).
 *
 * Continuous twin consumes `physicalLayout` / `conveyorNetwork` directly.
 * Details twin derives `TWIN_LAYOUT` from these constants so belt height and
 * zone/sensor X positions stay aligned without rewriting both scenes.
 */

import {
  BELT_TOP_Y,
  CONVEYOR_HEIGHT_M,
  CONVEYOR_LENGTH_M,
  CONVEYOR_SPEED_MPS,
  CONVEYOR_WIDTH_M,
  MAIN_BELT_WIDTH_M,
  ROLL_CAGE,
  ZONES,
} from '../physicalLayout';
import { CATEGORY_COLORS, INDUSTRIAL_PALETTE } from '../industrialTheme';
import type { Category } from '../types';

// Re-export palette + physical primitives used by both twins
export {
  BELT_TOP_Y,
  CONVEYOR_HEIGHT_M,
  CONVEYOR_LENGTH_M,
  CONVEYOR_SPEED_MPS,
  CONVEYOR_WIDTH_M,
  MAIN_BELT_WIDTH_M,
  ROLL_CAGE,
  ZONES,
};
export { CATEGORY_COLORS, INDUSTRIAL_PALETTE };

/** Conveyor dims shared across both twins. */
export const SHARED_CONVEYOR = {
  widthM: CONVEYOR_WIDTH_M,
  heightM: CONVEYOR_HEIGHT_M,
  lengthM: CONVEYOR_LENGTH_M,
  speedMps: CONVEYOR_SPEED_MPS,
  beltTopY: BELT_TOP_Y,
  beltWidthM: MAIN_BELT_WIDTH_M,
} as const;

/** Zone A/B/C/D positions (meters). */
export const SHARED_ZONES = {
  A: { x: ZONES.A.x, z: ZONES.A.z, label: ZONES.A.label },
  B: { x: ZONES.B.x, z: ZONES.B.z, label: ZONES.B.label },
  C: { x: ZONES.C.x, z: ZONES.C.z, label: ZONES.C.label },
  D: { x: ZONES.D.x, z: ZONES.D.z, label: ZONES.D.label },
} as const;

/** Sensor stations along the main belt. */
export const SHARED_SENSORS = {
  cameraX: ZONES.CAMERA.x,
  laserX: ZONES.LASER.x,
  /** Details twin only — mid-span between laser and gate. */
  ultrasonicX: (ZONES.LASER.x + ZONES.GATE.x) / 2,
} as const;

/** Stop-gate / diverter junction. */
export const SHARED_GATE = {
  x: ZONES.GATE.x,
  z: ZONES.GATE.z,
} as const;

/** Route exit directions after the gate (engineering + presentation). */
export const CLASS_ROUTE_DIRECTIONS: Record<
  Category,
  { axis: 'x' | 'z'; sign: 1 | -1; color: string }
> = {
  B: { axis: 'x', sign: 1, color: CATEGORY_COLORS.B },
  C: { axis: 'z', sign: 1, color: CATEGORY_COLORS.C },
  D: { axis: 'z', sign: -1, color: CATEGORY_COLORS.D },
};

/**
 * Details-twin layout derived from physical constants.
 * Keyframes still use progress ratios; only absolute meters change.
 */
export const DETAILS_TWIN_LAYOUT = {
  beltY: BELT_TOP_Y,
  startX: ZONES.A.x,
  endX: ZONES.B.x + 0.2,
  cameraX: SHARED_SENSORS.cameraX,
  laserX: SHARED_SENSORS.laserX,
  ultrasonicX: SHARED_SENSORS.ultrasonicX,
  gateX: SHARED_GATE.x,
  /** Buffer pocket just upstream of the gate. */
  accumulatorX: SHARED_GATE.x - 0.1,
  zoneBX: ZONES.B.x,
  zoneCZ: ZONES.C.z,
  zoneDZ: ZONES.D.z,
  rollCageSize: {
    x: ROLL_CAGE.width,
    y: ROLL_CAGE.height,
    z: ROLL_CAGE.depth,
  },
} as const;
