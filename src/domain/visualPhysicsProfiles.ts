/**
 * Stage 2 — visual physics profiles per SKU.
 *
 * ALL values are VISUAL_PHYSICS_ESTIMATE: they are tuned for physically
 * plausible drop/roll/rest behavior in the digital twin. They are NOT
 * certified masses or dynamics data from the manufacturer.
 */

export type ColliderKind = 'cuboid' | 'capsule' | 'cylinder';

export interface VisualPhysicsProfile {
  sku: string;
  /** VISUAL_PHYSICS_ESTIMATE kg */
  approximateMassKg: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  collider: ColliderKind;
  /** Capsule/cylinder symmetry axis ('y' = upright, 'x' = lying across the belt). */
  colliderAxis?: 'x' | 'y';
  /**
   * Collider half-extents [x,y,z] for cuboid; [radius, halfHeight] for
   * capsule/cylinder. MUST match validated Stage 1 dimensionsMm so the
   * collider bottom is flush with the visual item bottom (no spawn overlap).
   */
  cuboidHalfExtents?: [number, number, number];
  capsule?: [number, number];
  /** Vertical center-of-mass offset factor (-0.5..0.5 of height). */
  centerOfMassOffsetY: number;
  /** Multiplier on pusher impulse for C/D routing (light items fly further). */
  pusherImpulseScale: number;
  /** True for items expected to roll (cylinder/bottle). */
  canRoll: boolean;
}

const PROFILES: Record<string, VisualPhysicsProfile> = {
  'SKU-001': { // cardboard box 300x200x200
    sku: 'SKU-001', approximateMassKg: 0.8, friction: 0.55, restitution: 0.15,
    linearDamping: 0.2, angularDamping: 0.4, collider: 'cuboid',
    cuboidHalfExtents: [0.15, 0.1, 0.1], centerOfMassOffsetY: 0,
    pusherImpulseScale: 1.0, canRoll: false,
  },
  'SKU-002': { // lunchbox 280x180x120 — rigid box behavior
    sku: 'SKU-002', approximateMassKg: 0.6, friction: 0.5, restitution: 0.2,
    linearDamping: 0.2, angularDamping: 0.4, collider: 'cuboid',
    cuboidHalfExtents: [0.14, 0.06, 0.09], centerOfMassOffsetY: 0,
    pusherImpulseScale: 1.05, canRoll: false,
  },
  'SKU-005': { // pouf/ottoman d489 h264 — big soft fabric cylinder, UHMW slide
    sku: 'SKU-005', approximateMassKg: 3.0, friction: 0.45, restitution: 0.1,
    linearDamping: 0.3, angularDamping: 0.5, collider: 'cylinder',
    colliderAxis: 'y', capsule: [0.2445, 0.132], centerOfMassOffsetY: 0,
    pusherImpulseScale: 0.85, canRoll: false,
  },
  'SKU-004': { // oversized carton 900x200x500 — UHMW-coated chute strips
    sku: 'SKU-004', approximateMassKg: 3.2, friction: 0.4, restitution: 0.1,
    linearDamping: 0.25, angularDamping: 0.5, collider: 'cuboid',
    cuboidHalfExtents: [0.45, 0.25, 0.1], centerOfMassOffsetY: -0.05,
    pusherImpulseScale: 0.75, canRoll: false,
  },
  'SKU-006': { // ceramic plate d260 h30 — thin cuboid
    sku: 'SKU-006', approximateMassKg: 0.55, friction: 0.45, restitution: 0.25,
    linearDamping: 0.15, angularDamping: 0.25, collider: 'cuboid',
    cuboidHalfExtents: [0.13, 0.015, 0.13], centerOfMassOffsetY: 0,
    pusherImpulseScale: 1.1, canRoll: false,
  },
  'SKU-007': { // bottle d90 h280 — capsule, rolls/spins, falls to side
    sku: 'SKU-007', approximateMassKg: 0.45, friction: 0.5, restitution: 0.35,
    linearDamping: 0.1, angularDamping: 0.15, collider: 'capsule',
    capsule: [0.045, 0.095], centerOfMassOffsetY: -0.04,
    pusherImpulseScale: 1.15, canRoll: true,
  },
  'SKU-008': { // long cylinder 435x50x43 (dims are source of truth) — lies
    // across the belt, axis X; rolls in Z when the pusher sweeps it
    sku: 'SKU-008', approximateMassKg: 0.6, friction: 0.45, restitution: 0.2,
    linearDamping: 0.08, angularDamping: 0.12, collider: 'cylinder',
    colliderAxis: 'x', capsule: [0.0215, 0.2175], centerOfMassOffsetY: 0,
    pusherImpulseScale: 0.9, canRoll: true,
  },
  'SKU-009': { // pen 12x145x12 — light, spins fast
    sku: 'SKU-009', approximateMassKg: 0.02, friction: 0.4, restitution: 0.25,
    linearDamping: 0.1, angularDamping: 0.8, collider: 'capsule',
    capsule: [0.006, 0.066], centerOfMassOffsetY: 0,
    pusherImpulseScale: 1.3, canRoll: true,
  },
  'SKU-011': { // pouf round 500x300x300 — h/2=0.15 flush with dims
    sku: 'SKU-011', approximateMassKg: 2.8, friction: 0.6, restitution: 0.1,
    linearDamping: 0.4, angularDamping: 0.6, collider: 'cylinder',
    colliderAxis: 'y', capsule: [0.225, 0.15], centerOfMassOffsetY: 0,
    pusherImpulseScale: 0.85, canRoll: false,
  },
};

export const DEFAULT_PHYSICS_PROFILE: VisualPhysicsProfile = {
  sku: 'default', approximateMassKg: 1.0, friction: 0.8, restitution: 0.2,
  linearDamping: 0.2, angularDamping: 0.4, collider: 'cuboid',
  cuboidHalfExtents: [0.15, 0.1, 0.1], centerOfMassOffsetY: 0,
  pusherImpulseScale: 1.0, canRoll: false,
};

export function getVisualPhysicsProfile(itemId: string): VisualPhysicsProfile {
  return PROFILES[itemId] ?? DEFAULT_PHYSICS_PROFILE;
}

export function allVisualPhysicsProfiles(): VisualPhysicsProfile[] {
  return Object.values(PROFILES);
}
