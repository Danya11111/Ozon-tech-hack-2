/**
 * Stage 2 — single source of truth for static physics colliders.
 *
 * Pure data (no React, no Rapier): consumed by
 *  - SorterStaticColliders (runtime, @react-three/rapier CuboidColliders);
 *  - physicsDropSim (headless Node validation with rapier3d-compat).
 *
 * Geometry contract (visual == collider == domain kinematic surface):
 *  - C/D gravity chutes follow the domain chute line (conveyorNetwork
 *    CHUTE_C/D_ENTRY -> EXIT): from belt edge y=0.66 down to cage front edge
 *    y=0.14 — real gravity-chute pitch ~0.39 rad (smooth coated steel,
 *    friction 0.2), not a gentle ramp where items would stall.
 *  - Cage C/D entry side is OPEN (real roll cages are 3-sided + open front)
 *    with a 40mm sill; the chute deposits items through the open front.
 *  - B drop chute descends from spur end (2.15, 0.70) into the open front of
 *    the B receiver bin (past its low entry lip).
 * Every collider mirrors VISIBLE scene geometry — no fake guides (§11.6).
 */

import { ZONES, B_RECEIVER, ROLL_CAGE, CONVEYOR_WIDTH_M, BELT_TOP_Y, CAGE_FLOOR_Y } from './physicalLayout';

export interface StaticColliderDef {
  id: string;
  halfExtents: [number, number, number];
  position: [number, number, number];
  /** Euler XYZ radians. */
  rotation: [number, number, number];
  friction: number;
}

/**
 * C/D chute: top surface line from (z=±0.24, y≈0.665 — flush UNDER the belt
 * edge so even a 12mm pen cannot fall into a lip gap) to (z=±1.6, y≈0.135,
 * cage open front). tan ≈ 0.39 > μ_combined for every SKU -> items slide.
 */
/** Short transfer into close-in C/D cages (z≈±1.15). */
export const CHUTE_PITCH = Math.atan2(0.50, 0.55);
export const CHUTE_LENGTH = Math.hypot(0.55, 0.50);
export const CHUTE_MID_Y = 0.42;
export const CHUTE_MID_Z = 0.55;
export const CHUTE_X = 1.55;
export const CHUTE_HALF_W = 0.35;
export const B_CHUTE_PITCH = Math.atan2(BELT_TOP_Y - (CAGE_FLOOR_Y + 0.05), 0.45);

function chuteColliders(targetZ: number, label: 'C' | 'D'): StaticColliderDef[] {
  const dir = targetZ > 0 ? 1 : -1;
  const midZ = dir * CHUTE_MID_Z;
  const rot: [number, number, number] = [dir * CHUTE_PITCH, 0, 0];
  return [
    {
      id: `chute-${label}-floor`,
      halfExtents: [CHUTE_HALF_W, 0.01, CHUTE_LENGTH / 2],
      // top surface: y≈0.665 flush at belt edge (z 0.24) -> 0.135 at cage edge
      position: [CHUTE_X, CHUTE_MID_Y - 0.01, midZ],
      rotation: rot,
      friction: 0.2, // smooth coated steel — gravity chute (VISUAL_PHYSICS_ESTIMATE)
    },
    {
      id: `chute-${label}-rail-left`,
      halfExtents: [0.01, 0.035, CHUTE_LENGTH / 2],
      position: [CHUTE_X - CHUTE_HALF_W - 0.01, CHUTE_MID_Y + 0.035, midZ],
      rotation: rot,
      friction: 0.3,
    },
    {
      id: `chute-${label}-rail-right`,
      halfExtents: [0.01, 0.035, CHUTE_LENGTH / 2],
      position: [CHUTE_X + CHUTE_HALF_W + 0.01, CHUTE_MID_Y + 0.035, midZ],
      rotation: rot,
      friction: 0.3,
    },
  ];
}

function receiverColliders(): StaticColliderDef[] {
  const bin = B_RECEIVER;
  const hx = bin.width / 2;
  const hz = bin.depth / 2;
  const cage = ROLL_CAGE;
  const chx = cage.width / 2;
  const chz = cage.depth / 2;
  const defs: StaticColliderDef[] = [
    // B bin: floor + 3 walls + low entry lip (mirrors BReceiverBin visuals —
    // open front on the chute side, no hidden wall)
    { id: 'b-bin-floor', halfExtents: [hx, 0.02, hz], position: [bin.centerX, bin.floorY - 0.02, bin.centerZ], rotation: [0, 0, 0], friction: 0.8 },
    { id: 'b-bin-wall-z+', halfExtents: [hx, bin.wallHeight / 2, 0.015], position: [bin.centerX, bin.floorY + bin.wallHeight / 2, bin.centerZ + hz], rotation: [0, 0, 0], friction: 0.6 },
    { id: 'b-bin-wall-z-', halfExtents: [hx, bin.wallHeight / 2, 0.015], position: [bin.centerX, bin.floorY + bin.wallHeight / 2, bin.centerZ - hz], rotation: [0, 0, 0], friction: 0.6 },
    { id: 'b-bin-wall-x+', halfExtents: [0.015, bin.wallHeight / 2, hz], position: [bin.centerX + hx, bin.floorY + bin.wallHeight / 2, bin.centerZ], rotation: [0, 0, 0], friction: 0.6 },
    { id: 'b-bin-entry-lip', halfExtents: [0.015, 0.04, hz], position: [bin.centerX - hx, bin.floorY + 0.04, bin.centerZ], rotation: [0, 0, 0], friction: 0.6 },
  ];
  const entryX = bin.centerX - hx + 0.1;
  const chuteLen = Math.hypot(entryX - bin.transferEndX, BELT_TOP_Y - bin.floorY);
  defs.push({
    id: 'b-drop-chute',
    halfExtents: [chuteLen / 2, 0.008, (CONVEYOR_WIDTH_M - 0.08) / 2],
    // top surface runs (2.15, 0.696) -> (2.85, 0.126): flush with spur end
    position: [(bin.transferEndX + entryX) / 2, 0.395, bin.centerZ],
    rotation: [0, 0, -B_CHUTE_PITCH], // descends toward +X (into the bin)
    friction: 0.25,
  });
  for (const [label, zone] of [['C', ZONES.C], ['D', ZONES.D]] as const) {
    const entrySide = label === 'C' ? -1 : 1; // open front faces the conveyor
    defs.push(
      { id: `cage-${label}-floor`, halfExtents: [chx, 0.04, chz], position: [zone.x, 0.04, zone.z], rotation: [0, 0, 0], friction: 0.8 },
      { id: `cage-${label}-wall-x-`, halfExtents: [0.02, cage.height / 2, chz], position: [zone.x - chx, cage.height / 2, zone.z], rotation: [0, 0, 0], friction: 0.5 },
      { id: `cage-${label}-wall-x+`, halfExtents: [0.02, cage.height / 2, chz], position: [zone.x + chx, cage.height / 2, zone.z], rotation: [0, 0, 0], friction: 0.5 },
      // closed back wall (far side from the conveyor)
      { id: `cage-${label}-wall-back`, halfExtents: [chx, cage.height / 2, 0.02], position: [zone.x, cage.height / 2, zone.z - entrySide * chz], rotation: [0, 0, 0], friction: 0.5 },
      // 40mm sill on the open entry side (mirrors RollCageMesh openSide sill)
      { id: `cage-${label}-entry-sill`, halfExtents: [chx, 0.02, 0.015], position: [zone.x, CAGE_FLOOR_Y + 0.02, zone.z + entrySide * chz], rotation: [0, 0, 0], friction: 0.5 },
    );
  }
  return defs;
}

export function getStaticColliders(): StaticColliderDef[] {
  return [
    { id: 'world-floor', halfExtents: [8, 0.05, 6], position: [0, -0.05, 0], rotation: [0, 0, 0], friction: 0.8 },
    // Belt safety slab — items never pass through the belt surface.
    // Ends at the B spur end (2.15): beyond it the B drop chute takes over.
    // Continuous deck (no separate spur cuboid): an overlapping spur box
    // creates a vertical curb that stops velocity-coupled dynamic products.
    { id: 'belt-slab', halfExtents: [(2.15 + 4.2) / 2, 0.012, CONVEYOR_WIDTH_M / 2], position: [(2.15 - 4.2) / 2, BELT_TOP_Y - 0.014, 0], rotation: [0, 0, 0], friction: 0.7 },
    ...chuteColliders(ZONES.C.z, 'C'),
    ...chuteColliders(ZONES.D.z, 'D'),
    ...receiverColliders(),
  ];
}
