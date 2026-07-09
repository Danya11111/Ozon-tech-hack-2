/**
 * Conveyor Network — единый источник правды для физических поверхностей 3D сцены.
 *
 * Описывает физическую сеть транспортировки:
 *   conveyor A → inspection station → routing junction →
 *     B receiving zone  |  chute C → C roll-cage floor  |  chute D → D roll-cage floor
 *
 * Все координаты в метрах (1 Three.js unit = 1 meter).
 * Скорости в м/с. Никакой рандомизации и покадровых инкрементов — только геометрия.
 */

import type { Category } from './types';
import {
  ZONES,
  BELT_TOP_Y,
  CONVEYOR_SPEED_MPS,
  MAIN_BELT_WIDTH_M,
  CHUTE_C_WIDTH_M,
  CHUTE_D_WIDTH_M,
  CHUTE_END_Y,
  CAGE_FLOOR_Y,
  ROLL_CAGE,
  B_RECEIVER,
} from './physicalLayout';

export type SurfaceName =
  | 'main_belt'
  | 'inspection_station'
  | 'routing_junction'
  | 'b_receiver'
  | 'chute_c'
  | 'chute_d'
  | 'c_cage_floor'
  | 'd_cage_floor';

export type Vec3 = [number, number, number];

export interface SurfaceBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Surface {
  name: SurfaceName;
  /** Entry point of the surface (item enters here). */
  start: Vec3;
  /** Exit point of the surface (item leaves here). */
  end: Vec3;
  /** Top surface height where the item bottom rests. */
  surfaceY: number;
  /** Physical width of the surface in meters. */
  width: number;
  /** Transport speed along the surface in m/s (0 for a static bin/junction). */
  speedMps: number;
  /** Axis-aligned bounds (containment check). */
  bounds: SurfaceBounds;
  /** Destination category, if this surface belongs to a routing branch. */
  targetCategory?: Category;
}

const A = ZONES.A;           // spawn
const CAMERA = ZONES.CAMERA; // inspection
const GATE = ZONES.GATE;     // routing junction
const C = ZONES.C;           // cage C center
const D = ZONES.D;           // cage D center

/** Half-extents of a roll cage along X (width) and Z (depth). */
const CAGE_HALF_X = ROLL_CAGE.width / 2;   // 0.6
const CAGE_HALF_Z = ROLL_CAGE.depth / 2;   // 0.4

/** Chute entry sits at the junction on the belt edge toward the cage. */
const CHUTE_C_ENTRY: Vec3 = [GATE.x, BELT_TOP_Y, MAIN_BELT_WIDTH_M / 2];
const CHUTE_C_EXIT: Vec3 = [C.x, CHUTE_END_Y, C.z - CAGE_HALF_Z]; // front edge of cage C
const CHUTE_D_ENTRY: Vec3 = [GATE.x, BELT_TOP_Y, -MAIN_BELT_WIDTH_M / 2];
const CHUTE_D_EXIT: Vec3 = [D.x, CHUTE_END_Y, D.z + CAGE_HALF_Z]; // front edge of cage D

/** Chute transport speed (slower than belt, gravity-fed slide, still not a flight). */
export const CHUTE_SPEED_MPS = 0.5;

export const SURFACES: Record<SurfaceName, Surface> = {
  main_belt: {
    name: 'main_belt',
    start: [A.x, BELT_TOP_Y, 0],
    end: [CAMERA.x, BELT_TOP_Y, 0],
    surfaceY: BELT_TOP_Y,
    width: MAIN_BELT_WIDTH_M,
    speedMps: CONVEYOR_SPEED_MPS,
    bounds: { minX: A.x, maxX: CAMERA.x, minZ: -MAIN_BELT_WIDTH_M / 2, maxZ: MAIN_BELT_WIDTH_M / 2 },
  },
  inspection_station: {
    name: 'inspection_station',
    start: [CAMERA.x, BELT_TOP_Y, 0],
    end: [CAMERA.x, BELT_TOP_Y, 0],
    surfaceY: BELT_TOP_Y,
    width: MAIN_BELT_WIDTH_M,
    speedMps: 0, // dwell for detection
    bounds: { minX: CAMERA.x - 0.4, maxX: CAMERA.x + 0.4, minZ: -MAIN_BELT_WIDTH_M / 2, maxZ: MAIN_BELT_WIDTH_M / 2 },
  },
  routing_junction: {
    name: 'routing_junction',
    start: [CAMERA.x, BELT_TOP_Y, 0],
    end: [GATE.x, BELT_TOP_Y, 0],
    surfaceY: BELT_TOP_Y,
    width: MAIN_BELT_WIDTH_M,
    speedMps: CONVEYOR_SPEED_MPS,
    bounds: { minX: CAMERA.x, maxX: GATE.x, minZ: -MAIN_BELT_WIDTH_M / 2, maxZ: MAIN_BELT_WIDTH_M / 2 },
  },
  b_receiver: {
    name: 'b_receiver',
    start: [GATE.x, BELT_TOP_Y, 0],
    end: [B_RECEIVER.restX, BELT_TOP_Y, 0],
    surfaceY: B_RECEIVER.y,
    width: B_RECEIVER.width,
    speedMps: CONVEYOR_SPEED_MPS,
    bounds: {
      minX: B_RECEIVER.startX,
      maxX: B_RECEIVER.endX,
      minZ: -B_RECEIVER.width / 2,
      maxZ: B_RECEIVER.width / 2,
    },
    targetCategory: 'B',
  },
  chute_c: {
    name: 'chute_c',
    start: CHUTE_C_ENTRY,
    end: CHUTE_C_EXIT,
    surfaceY: BELT_TOP_Y,
    width: CHUTE_C_WIDTH_M,
    speedMps: CHUTE_SPEED_MPS,
    bounds: {
      minX: Math.min(CHUTE_C_ENTRY[0], CHUTE_C_EXIT[0]) - 0.1,
      maxX: Math.max(CHUTE_C_ENTRY[0], CHUTE_C_EXIT[0]) + 0.1,
      minZ: Math.min(CHUTE_C_ENTRY[2], CHUTE_C_EXIT[2]),
      maxZ: Math.max(CHUTE_C_ENTRY[2], CHUTE_C_EXIT[2]),
    },
    targetCategory: 'C',
  },
  chute_d: {
    name: 'chute_d',
    start: CHUTE_D_ENTRY,
    end: CHUTE_D_EXIT,
    surfaceY: BELT_TOP_Y,
    width: CHUTE_D_WIDTH_M,
    speedMps: CHUTE_SPEED_MPS,
    bounds: {
      minX: Math.min(CHUTE_D_ENTRY[0], CHUTE_D_EXIT[0]) - 0.1,
      maxX: Math.max(CHUTE_D_ENTRY[0], CHUTE_D_EXIT[0]) + 0.1,
      minZ: Math.min(CHUTE_D_ENTRY[2], CHUTE_D_EXIT[2]),
      maxZ: Math.max(CHUTE_D_ENTRY[2], CHUTE_D_EXIT[2]),
    },
    targetCategory: 'D',
  },
  c_cage_floor: {
    name: 'c_cage_floor',
    start: [C.x, CAGE_FLOOR_Y, C.z],
    end: [C.x, CAGE_FLOOR_Y, C.z],
    surfaceY: CAGE_FLOOR_Y,
    width: ROLL_CAGE.width,
    speedMps: 0,
    bounds: {
      minX: C.x - CAGE_HALF_X,
      maxX: C.x + CAGE_HALF_X,
      minZ: C.z - CAGE_HALF_Z,
      maxZ: C.z + CAGE_HALF_Z,
    },
    targetCategory: 'C',
  },
  d_cage_floor: {
    name: 'd_cage_floor',
    start: [D.x, CAGE_FLOOR_Y, D.z],
    end: [D.x, CAGE_FLOOR_Y, D.z],
    surfaceY: CAGE_FLOOR_Y,
    width: ROLL_CAGE.width,
    speedMps: 0,
    bounds: {
      minX: D.x - CAGE_HALF_X,
      maxX: D.x + CAGE_HALF_X,
      minZ: D.z - CAGE_HALF_Z,
      maxZ: D.z + CAGE_HALF_Z,
    },
    targetCategory: 'D',
  },
};

export function getSurface(name: SurfaceName): Surface {
  return SURFACES[name];
}

/** Linear interpolation between two 3D points. */
export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * clamped,
    a[1] + (b[1] - a[1]) * clamped,
    a[2] + (b[2] - a[2]) * clamped,
  ];
}

/** Euclidean length of a surface from start to end (meters). */
export function surfaceLength(name: SurfaceName): number {
  const s = SURFACES[name];
  const dx = s.end[0] - s.start[0];
  const dy = s.end[1] - s.start[1];
  const dz = s.end[2] - s.start[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** True if a point lies within the (padded) horizontal bounds of a surface. */
export function isWithinBounds(name: SurfaceName, x: number, z: number): boolean {
  const b = SURFACES[name].bounds;
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/** Heading (Y rotation) of a surface's travel direction, in radians. */
export function surfaceHeading(name: SurfaceName): number {
  const s = SURFACES[name];
  return Math.atan2(s.end[2] - s.start[2], s.end[0] - s.start[0]);
}

/** Ordered surfaces an item traverses for a given destination category. */
export function pathForCategory(category: Category): SurfaceName[] {
  if (category === 'C') {
    return ['main_belt', 'inspection_station', 'routing_junction', 'chute_c', 'c_cage_floor'];
  }
  if (category === 'D') {
    return ['main_belt', 'inspection_station', 'routing_junction', 'chute_d', 'd_cage_floor'];
  }
  return ['main_belt', 'inspection_station', 'routing_junction', 'b_receiver'];
}
