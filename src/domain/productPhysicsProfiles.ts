/**
 * Canonical product physics profiles + belt-drive helpers.
 *
 * All mass/friction/damping values are ENGINEERING_DERIVED for stable digital-twin
 * behavior. They are not certified manufacturer masses.
 */

import {
  BELT_TOP_Y,
  CAD_GATE_ENGAGE_X,
  CONVEYOR_SPEED_MPS,
  CONVEYOR_WIDTH_M,
  DISCHARGE_EDGE_S,
  worldContactPlaneS,
  ZONES,
} from './physicalLayout';

export const BELT_SPEED_MPS = CONVEYOR_SPEED_MPS; // exactly 1.0
export const BELT_RESPONSE_TIME_SEC = 0.35;
export const BELT_SPEED_EPSILON = 0.02;
export const LATERAL_DAMPING_GAIN = 2.5;
export const MAX_LATERAL_CORRECTION_MPS2 = 1.5;
export const SPAWN_CLEARANCE_M = 0.002;
export const MAX_PRODUCT_SPEED_MPS = 4.0;
export const MAX_ANGULAR_SPEED_RAD_S = 12.0;

/** World axes confirmed by physicalLayout (+X downstream, +Y up, +Z left). */
export const DOWNSTREAM_AXIS: [number, number, number] = [1, 0, 0];
export const UP_AXIS: [number, number, number] = [0, 1, 0];
export const LATERAL_AXIS: [number, number, number] = [0, 0, 1];

export const BELT_START_S = ZONES.A.x;
/** Start of physical junction / possible diverter contact (world plane). */
export const JUNCTION_ENTRY_S = worldContactPlaneS();
/** Belt surface ends at the canonical discharge edge — no support beyond. */
export const BELT_END_S = DISCHARGE_EDGE_S;
/** @deprecated alias — engage X retained for layout references */
export const CAD_GATE_ENGAGE_S = CAD_GATE_ENGAGE_X;

export type ProductPhysicsPhase =
  | 'preparing'
  | 'physical_conveyor'
  | 'junction'
  | 'settled'
  | 'invalid';

export type ProductCollider =
  | { type: 'cuboid'; halfExtents: [number, number, number] }
  | { type: 'cylinder'; radius: number; halfHeight: number; axis: 'x' | 'y' }
  | { type: 'capsule'; radius: number; halfHeight: number; axis: 'x' | 'y' };

export type ProductPhysicsProfile = {
  productId: string;
  /** ENGINEERING_DERIVED */
  massKg: number;
  collider: ProductCollider;
  centerOfMassOffset: [number, number, number];
  beltFriction: number;
  guideFriction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  lockRotationX: boolean;
  lockRotationY: boolean;
  lockRotationZ: boolean;
  maxBeltAccelerationMps2: number;
  ccd: true;
  provenance: 'ENGINEERING_DERIVED';
};

const PROFILES: Record<string, ProductPhysicsProfile> = {
  'SKU-001': {
    productId: 'SKU-001', massKg: 0.8,
    collider: { type: 'cuboid', halfExtents: [0.15, 0.1, 0.1] },
    centerOfMassOffset: [0, 0, 0],
    beltFriction: 0.75, guideFriction: 0.35, restitution: 0.02,
    linearDamping: 0.25, angularDamping: 3.5,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    // Accel budget must overcome stationary-belt friction (μN/m ≈ 5–6 m/s²).
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-002': {
    productId: 'SKU-002', massKg: 0.55,
    collider: { type: 'cuboid', halfExtents: [0.1005, 0.031, 0.076] },
    centerOfMassOffset: [0, 0, 0],
    beltFriction: 0.7, guideFriction: 0.3, restitution: 0.03,
    linearDamping: 0.25, angularDamping: 3.2,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-004': {
    productId: 'SKU-004', massKg: 1.4,
    // Sized to clear the neutral corridor and slide on the 45° guide face.
    collider: { type: 'cuboid', halfExtents: [0.16, 0.12, 0.12] },
    centerOfMassOffset: [0, -0.02, 0],
    beltFriction: 0.65, guideFriction: 0.25, restitution: 0.02,
    linearDamping: 0.28, angularDamping: 4.0,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-005': {
    productId: 'SKU-005', massKg: 1.6,
    // Corridor-compatible cylinder (visual drum scaled for junction clearance).
    collider: { type: 'cylinder', radius: 0.11, halfHeight: 0.12, axis: 'y' },
    centerOfMassOffset: [0, -0.01, 0],
    beltFriction: 0.7, guideFriction: 0.28, restitution: 0.01,
    linearDamping: 0.3, angularDamping: 4.5,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-006': {
    productId: 'SKU-006', massKg: 0.45,
    collider: { type: 'cuboid', halfExtents: [0.105, 0.0135, 0.1045] },
    centerOfMassOffset: [0, 0, 0],
    beltFriction: 0.8, guideFriction: 0.35, restitution: 0.04,
    linearDamping: 0.2, angularDamping: 3.0,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-007': {
    productId: 'SKU-007', massKg: 0.4,
    collider: { type: 'capsule', radius: 0.0455, halfHeight: 0.107, axis: 'y' },
    centerOfMassOffset: [0, -0.02, 0],
    beltFriction: 0.65, guideFriction: 0.35, restitution: 0.02,
    linearDamping: 0.25, angularDamping: 5.0,
    // Tall bottle: lock tip-over axes for stable belt/junction contact.
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-008': {
    productId: 'SKU-008', massKg: 0.55,
    // Standing cylinder (visual bottle) — Y axis; X-lying rolls off the belt.
    collider: { type: 'cylinder', radius: 0.045, halfHeight: 0.11, axis: 'y' },
    centerOfMassOffset: [0, -0.01, 0],
    beltFriction: 0.7, guideFriction: 0.35, restitution: 0.02,
    linearDamping: 0.25, angularDamping: 4.5,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-009': {
    productId: 'SKU-009', massKg: 0.05,
    // Thin pen: slightly larger contact radius so it does not tunnel the belt deck.
    collider: { type: 'capsule', radius: 0.012, halfHeight: 0.06, axis: 'y' },
    centerOfMassOffset: [0, 0, 0],
    beltFriction: 0.75, guideFriction: 0.35, restitution: 0.01,
    linearDamping: 0.35, angularDamping: 6.0,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 14, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
  'SKU-011': {
    productId: 'SKU-011', massKg: 2.8,
    collider: { type: 'cylinder', radius: 0.225, halfHeight: 0.15, axis: 'y' },
    centerOfMassOffset: [0, 0, 0],
    beltFriction: 0.75, guideFriction: 0.4, restitution: 0.01,
    linearDamping: 0.35, angularDamping: 4.5,
    lockRotationX: true, lockRotationY: false, lockRotationZ: true,
    maxBeltAccelerationMps2: 10, ccd: true, provenance: 'ENGINEERING_DERIVED',
  },
};

export const DEFAULT_PRODUCT_PHYSICS_PROFILE: ProductPhysicsProfile = {
  productId: 'default', massKg: 1.0,
  collider: { type: 'cuboid', halfExtents: [0.1, 0.08, 0.08] },
  centerOfMassOffset: [0, 0, 0],
  beltFriction: 0.7, guideFriction: 0.3, restitution: 0.02,
  linearDamping: 0.25, angularDamping: 3.5,
  lockRotationX: true, lockRotationY: false, lockRotationZ: true,
  maxBeltAccelerationMps2: 12, ccd: true, provenance: 'ENGINEERING_DERIVED',
};

export function getProductPhysicsProfile(productId: string): ProductPhysicsProfile {
  const id = productId.replace(/-LC$/, '');
  return PROFILES[id] ?? DEFAULT_PRODUCT_PHYSICS_PROFILE;
}

export function allProductPhysicsProfiles(): ProductPhysicsProfile[] {
  return Object.values(PROFILES);
}

export function colliderHalfHeight(profile: ProductPhysicsProfile): number {
  const c = profile.collider;
  if (c.type === 'cuboid') return c.halfExtents[1];
  // Capsule tips extend by radius beyond halfHeight; cylinder radius is lateral on Y.
  if (c.type === 'capsule') {
    return c.axis === 'y' ? c.halfHeight + c.radius : c.radius;
  }
  return c.axis === 'y' ? c.halfHeight : c.radius;
}

export function spawnCenterY(profile: ProductPhysicsProfile): number {
  return BELT_TOP_Y + colliderHalfHeight(profile) + SPAWN_CLEARANCE_M;
}

export function isSupportedByBelt(input: {
  position: [number, number, number];
  halfHeight: number;
  phase: ProductPhysicsPhase;
  linearVelY: number;
}): boolean {
  if (input.phase !== 'physical_conveyor' && input.phase !== 'junction') return false;
  const [x, y, z] = input.position;
  if (x < BELT_START_S - 0.05 || x > BELT_END_S) return false;
  // Laterally off the belt deck (entering C/D chutes) — no belt drive.
  if (Math.abs(z) > CONVEYOR_WIDTH_M / 2 + 0.08) return false;
  const bottomY = y - input.halfHeight;
  if (bottomY > BELT_TOP_Y + 0.025) return false; // airborne
  if (bottomY < BELT_TOP_Y - 0.04) return false; // sunk / off belt
  if (input.linearVelY < -1.5) return false; // free-falling
  return true;
}

export type BeltForceSample = {
  currentDownstreamSpeed: number;
  speedError: number;
  appliedAcceleration: number;
  force: [number, number, number];
  lateralCorrection: [number, number, number];
  withinDeadband: boolean;
};

export function computeBeltDriveForce(input: {
  massKg: number;
  linearVelocity: [number, number, number];
  maxBeltAccelerationMps2: number;
  applyLateralCorrection: boolean;
  responseTimeSec?: number;
  targetSpeedMps?: number;
}): BeltForceSample {
  const target = input.targetSpeedMps ?? BELT_SPEED_MPS;
  const response = input.responseTimeSec ?? BELT_RESPONSE_TIME_SEC;
  const [vx, , vz] = input.linearVelocity;
  // Downstream is +X; lateral is +Z (layout contract).
  const downstreamSpeed = vx * DOWNSTREAM_AXIS[0] + vz * DOWNSTREAM_AXIS[2];
  const lateralVelocity = vx * LATERAL_AXIS[0] + vz * LATERAL_AXIS[2];
  const speedError = target - downstreamSpeed;
  const withinDeadband = Math.abs(speedError) <= BELT_SPEED_EPSILON;

  let appliedAcceleration = 0;
  if (!withinDeadband) {
    const desired = speedError / response;
    appliedAcceleration = Math.max(
      -input.maxBeltAccelerationMps2,
      Math.min(input.maxBeltAccelerationMps2, desired),
    );
  }

  const force: [number, number, number] = [
    input.massKg * appliedAcceleration * DOWNSTREAM_AXIS[0],
    input.massKg * appliedAcceleration * DOWNSTREAM_AXIS[1],
    input.massKg * appliedAcceleration * DOWNSTREAM_AXIS[2],
  ];

  let lateralCorrection: [number, number, number] = [0, 0, 0];
  if (input.applyLateralCorrection) {
    let aLat = -lateralVelocity * LATERAL_DAMPING_GAIN;
    aLat = Math.max(-MAX_LATERAL_CORRECTION_MPS2, Math.min(MAX_LATERAL_CORRECTION_MPS2, aLat));
    lateralCorrection = [
      input.massKg * aLat * LATERAL_AXIS[0],
      input.massKg * aLat * LATERAL_AXIS[1],
      input.massKg * aLat * LATERAL_AXIS[2],
    ];
  }

  return {
    currentDownstreamSpeed: downstreamSpeed,
    speedError,
    appliedAcceleration,
    force,
    lateralCorrection,
    withinDeadband,
  };
}

export function isInvalidProductState(input: {
  position: [number, number, number];
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
}): boolean {
  const vals = [...input.position, ...input.linearVelocity, ...input.angularVelocity];
  if (vals.some((v) => !Number.isFinite(v))) return true;
  const [x, y, z] = input.position;
  if (y < -0.5 || y > 5 || Math.abs(x) > 12 || Math.abs(z) > 6) return true;
  const speed = Math.hypot(...input.linearVelocity);
  if (speed > MAX_PRODUCT_SPEED_MPS) return true;
  const ang = Math.hypot(...input.angularVelocity);
  if (ang > MAX_ANGULAR_SPEED_RAD_S) return true;
  return false;
}

/** Dev/test counter — must stay 0 in normal validation runs. */
export let INVALID_PRODUCT_STATE_COUNT = 0;

export function resetInvalidProductStateCount() {
  INVALID_PRODUCT_STATE_COUNT = 0;
}

export function recordInvalidProductState() {
  INVALID_PRODUCT_STATE_COUNT += 1;
}
