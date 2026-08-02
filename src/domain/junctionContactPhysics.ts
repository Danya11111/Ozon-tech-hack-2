/**
 * Physical junction contact — CAD diverter colliders + deterministic route matrix.
 *
 * Frozen documented LOCAL sorter offsets (do not change numeric meaning):
 *   DOCUMENTED_LOCAL_CONTACT_OFFSET = 1.0538
 *   DOCUMENTED_LOCAL_CLEAR_OFFSET   = 1.6000
 *
 * Runtime world planes = sorterAssemblyOriginS + local offset.
 *
 * Collider half-extents [halfLength, halfHeight, halfThickness] = [0.375, 0.05, 0.02]
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { getStaticColliders } from './physicsWorldLayout';
import {
  getProductPhysicsProfile,
  colliderHalfHeight,
  spawnCenterY,
  isSupportedByBelt,
  BELT_SPEED_MPS,
  type ProductPhysicsProfile,
} from './productPhysicsProfiles';
import {
  GATE_VANE,
  DIVERTER_LEFT_SIGNED_DEG,
  DIVERTER_RIGHT_SIGNED_DEG,
  categoryToPhysicalRoute,
} from './pusherMotion';
import { receiverContains, type ReceiverZone } from './receiverVolumes';
import { PHYSICS_TIMESTEP_SEC } from './physicsTimestep';
import {
  CONVEYOR_WIDTH_M,
  DISCHARGE_EDGE_S,
  DOCUMENTED_LOCAL_CLEAR_OFFSET,
  DOCUMENTED_LOCAL_CONTACT_OFFSET,
  SORTER_ASSEMBLY_ORIGIN_S,
  worldClearPlaneS,
  worldContactPlaneS,
} from './physicalLayout';

/** Local offset aliases (canonical documented values). */
export const DOCUMENTED_CONTACT_PLANE_S = DOCUMENTED_LOCAL_CONTACT_OFFSET;
export const DOCUMENTED_CLEAR_PLANE_S = DOCUMENTED_LOCAL_CLEAR_OFFSET;

export function runtimeWorldContactPlaneS(): number {
  return worldContactPlaneS();
}
export function runtimeWorldClearPlaneS(): number {
  return worldClearPlaneS();
}

/** Falling physics must remain identical after support removal. */
export const FALL_PHYSICS_PARAMETERS_UNCHANGED = true as const;
export const FALL_GRAVITY_Y = -9.81;
export const FALL_SETTLE_LINEAR_SPEED_MPS = 0.20;
export const FALL_SETTLE_ANGULAR_SPEED_RAD_S = 1.0;
export const FALL_SETTLE_DURATION_SEC = 0.30;

export const DIVERTER_COLLIDER_HALF_EXTENTS: [number, number, number] = [
  GATE_VANE.halfExtents[0],
  GATE_VANE.halfExtents[1],
  GATE_VANE.halfExtents[2],
];

export const DIVERTER_GUIDE_FRICTION = 0.22;
export const DIVERTER_RESTITUTION = 0.0;

export const SETTLE_LINEAR_SPEED_MPS = FALL_SETTLE_LINEAR_SPEED_MPS;
export const SETTLE_ANGULAR_SPEED_RAD_S = FALL_SETTLE_ANGULAR_SPEED_RAD_S;
export const SETTLE_DURATION_SEC = FALL_SETTLE_DURATION_SEC;
export const STUCK_TIMEOUT_SEC = 3.0;

const HINGE_LOCAL_S = 1.55;
export const DIVERTER_WORLD_PIVOTS = {
  left: {
    x: SORTER_ASSEMBLY_ORIGIN_S + HINGE_LOCAL_S,
    y: GATE_VANE.centerY,
    z: +(CONVEYOR_WIDTH_M / 2 - 0.02),
  },
  right: {
    x: SORTER_ASSEMBLY_ORIGIN_S + HINGE_LOCAL_S,
    y: GATE_VANE.centerY,
    z: -(CONVEYOR_WIDTH_M / 2 - 0.02),
  },
};

export { DISCHARGE_EDGE_S, SORTER_ASSEMBLY_ORIGIN_S };

export type JunctionFailure =
  | 'WRONG_RECEIVER_ENTRY'
  | 'MISSED_RECEIVER'
  | 'PRODUCT_STUCK_IN_JUNCTION'
  | 'PRODUCT_TUNNELLED_THROUGH_GUIDE'
  | 'PRODUCT_LEFT_CONVEYOR'
  | 'PRODUCT_OVER_SPEED'
  | 'PRODUCT_UNDER_BELT'
  | 'DIVERTER_CONTACT_WHILE_OPENING'
  | 'INVALID_TRANSFORM';

export interface JunctionRunResult {
  skuId: string;
  expectedZone: ReceiverZone;
  physicalRoute: ReturnType<typeof categoryToPhysicalRoute>;
  finalPosition: [number, number, number];
  receiverEntered: ReceiverZone | null;
  correctReceiver: boolean;
  contactCount: number;
  contactWhileOpening: number;
  maxSpeedMps: number;
  maxAngularSpeed: number;
  stuck: boolean;
  tunnelling: boolean;
  invalidState: boolean;
  failure: JunctionFailure | null;
  stepsSimulated: number;
  lateralDisplacement: number;
}

export interface DiverterColliderPose {
  pivot: { x: number; y: number; z: number };
  yawRad: number;
  center: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

export function diverterColliderPose(
  pivot: { x: number; y: number; z: number },
  yawRad: number,
  halfLength = DIVERTER_COLLIDER_HALF_EXTENTS[0],
): DiverterColliderPose {
  const x = pivot.x - Math.cos(yawRad) * halfLength;
  const z = pivot.z + Math.sin(yawRad) * halfLength;
  const half = yawRad / 2;
  return {
    pivot: { ...pivot },
    yawRad,
    center: { x, y: pivot.y, z },
    rotation: { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) },
  };
}

export function hingeDriftMm(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1000;
}

export function angleDifferenceDeg(a: number, b: number): number {
  return (Math.abs(a - b) * 180) / Math.PI;
}

export function neutralCorridorWidthM(
  leftPivotZ = DIVERTER_WORLD_PIVOTS.left.z,
  rightPivotZ = DIVERTER_WORLD_PIVOTS.right.z,
  halfThickness = DIVERTER_COLLIDER_HALF_EXTENTS[2],
): number {
  const leftInner = leftPivotZ - halfThickness;
  const rightInner = rightPivotZ + halfThickness;
  return leftInner - rightInner;
}

export function detectReceiverZone(p: [number, number, number]): ReceiverZone | null {
  if (receiverContains('B', p)) return 'B';
  if (receiverContains('C', p)) return 'C';
  if (receiverContains('D', p)) return 'D';
  return null;
}

function quatFromEuler(x: number, y: number, z: number) {
  const c1 = Math.cos(x / 2); const c2 = Math.cos(y / 2); const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2); const s2 = Math.sin(y / 2); const s3 = Math.sin(z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

function productColliderDesc(profile: ProductPhysicsProfile): RAPIER.ColliderDesc {
  const c = profile.collider;
  let desc: RAPIER.ColliderDesc;
  if (c.type === 'cuboid') {
    const [hx, hy, hz] = c.halfExtents;
    desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    desc.setDensity(profile.massKg / (8 * hx * hy * hz));
  } else if (c.type === 'capsule') {
    desc = RAPIER.ColliderDesc.capsule(c.halfHeight, c.radius);
    desc.setDensity(
      profile.massKg
        / (Math.PI * c.radius * c.radius * (2 * c.halfHeight + (4 / 3) * c.radius)),
    );
    if (c.axis === 'x') desc.setRotation(quatFromEuler(0, 0, Math.PI / 2));
  } else {
    desc = RAPIER.ColliderDesc.cylinder(c.halfHeight, c.radius);
    desc.setDensity(profile.massKg / (Math.PI * c.radius * c.radius * 2 * c.halfHeight));
    if (c.axis === 'x') desc.setRotation(quatFromEuler(0, 0, Math.PI / 2));
  }
  desc.setFriction(profile.guideFriction);
  desc.setRestitution(Math.min(profile.restitution, 0.03));
  return desc;
}

function applyDiverterKinematic(
  body: RAPIER.RigidBody,
  side: 'left' | 'right',
  yawRad: number,
) {
  const pose = diverterColliderPose(DIVERTER_WORLD_PIVOTS[side], yawRad);
  body.setNextKinematicTranslation(pose.center);
  body.setNextKinematicRotation(pose.rotation);
}

export function simulateJunctionContact(
  skuId: string,
  category: ReceiverZone,
): JunctionRunResult {
  const profile = getProductPhysicsProfile(skuId);
  const route = categoryToPhysicalRoute(category);
  const halfH = colliderHalfHeight(profile);
  const spawnX = -3.2;
  const spawnY = spawnCenterY(profile);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSICS_TIMESTEP_SEC;

  const leftYaw = category === 'C' ? (DIVERTER_LEFT_SIGNED_DEG * Math.PI) / 180 : 0;
  const rightYaw = category === 'D' ? (DIVERTER_RIGHT_SIGNED_DEG * Math.PI) / 180 : 0;

  try {
    for (const c of getStaticColliders()) {
      const q = quatFromEuler(c.rotation[0], c.rotation[1], c.rotation[2]);
      // Junction sim uses velocity-coupled belt drive against a stationary
      // deck — keep belt tangential friction low so contact can redirect C/D.
      const friction = c.id === 'belt-slab' ? 0.15 : c.friction;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(c.halfExtents[0], c.halfExtents[1], c.halfExtents[2])
          .setTranslation(c.position[0], c.position[1], c.position[2])
          .setRotation(q)
          .setFriction(friction),
      );
    }

    const [hx, hy, hz] = DIVERTER_COLLIDER_HALF_EXTENTS;
    const leftPose0 = diverterColliderPose(DIVERTER_WORLD_PIVOTS.left, leftYaw);
    const rightPose0 = diverterColliderPose(DIVERTER_WORLD_PIVOTS.right, rightYaw);

    // Do not setRotation on create — apply via setNextKinematic* each step
    // (create-time quat objects NaN the island when paired with applyImpulse).
    const leftBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(leftPose0.center.x, leftPose0.center.y, leftPose0.center.z),
    );
    const leftCol = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(DIVERTER_GUIDE_FRICTION)
        .setRestitution(DIVERTER_RESTITUTION),
      leftBody,
    );

    const rightBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(rightPose0.center.x, rightPose0.center.y, rightPose0.center.z),
    );
    const rightCol = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(DIVERTER_GUIDE_FRICTION)
        .setRestitution(DIVERTER_RESTITUTION),
      rightBody,
    );

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnX, spawnY, 0)
        .setLinvel(BELT_SPEED_MPS * 0.5, 0, 0)
        .setCcdEnabled(true)
        .setLinearDamping(profile.linearDamping)
        .setAngularDamping(profile.angularDamping)
        .enabledRotations(
          !profile.lockRotationX,
          !profile.lockRotationY,
          !profile.lockRotationZ,
        ),
    );
    const itemCol = world.createCollider(productColliderDesc(profile), body);

    let contactCount = 0;
    const contactWhileOpening = 0;
    let maxSpeed = 0;
    let maxAng = 0;
    let tunnelling = false;
    let invalidState = false;
    let stuck = false;
    let receiverEntered: ReceiverZone | null = null;
    let settleAccum = 0;
    let lastProgressX = spawnX;
    let lastProgressZ = 0;
    let stuckClock = 0;
    let steps = 0;
    const maxSteps = Math.round(14 / PHYSICS_TIMESTEP_SEC);

    for (let i = 0; i < maxSteps; i += 1) {
      applyDiverterKinematic(leftBody, 'left', leftYaw);
      applyDiverterKinematic(rightBody, 'right', rightYaw);

      const t = body.translation();
      const lv = body.linvel();
      if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.z)) {
        invalidState = true;
        break;
      }

      // Pre-step belt surface velocity (1.0 m/s downstream) while supported.
      {
        const contactS = runtimeWorldContactPlaneS();
        const phase = t.x >= contactS ? 'junction' : 'physical_conveyor';
        const supported = isSupportedByBelt({
          position: [t.x, t.y, t.z],
          halfHeight: halfH,
          phase,
          linearVelY: lv.y,
        });
        if (supported) {
          // Upstream: hard-couple to belt speed. Inside junction: gently pull
          // toward 1.0 m/s without wiping contact-induced lateral velocity.
          const inJunction = t.x >= contactS;
          const targetVx = inJunction
            ? lv.x + Math.max(-8, Math.min(8, (BELT_SPEED_MPS - lv.x) * 0.35))
            : BELT_SPEED_MPS;
          body.setLinvel({
            x: targetVx,
            y: Math.min(lv.y, 0.05),
            z: inJunction ? lv.z : lv.z * 0.85,
          }, true);
        }
      }

      world.step();
      steps += 1;

      let touching = false;
      world.contactPairsWith(itemCol, (other) => {
        if (other.handle === leftCol.handle || other.handle === rightCol.handle) {
          touching = true;
        }
      });
      if (touching) contactCount += 1;

      const t2 = body.translation();
      const lv2 = body.linvel();
      const av2 = body.angvel();
      const speed = Math.hypot(lv2.x, lv2.y, lv2.z);
      const ang = Math.hypot(av2.x, av2.y, av2.z);
      maxSpeed = Math.max(maxSpeed, speed);
      maxAng = Math.max(maxAng, ang);

      if (
        t2.y < 0.2
        && Math.abs(t2.z) < 0.12
        && t2.x < DISCHARGE_EDGE_S
        && t2.x > SORTER_ASSEMBLY_ORIGIN_S + 0.2
      ) {
        tunnelling = true;
      }
      if (speed > 4.0) {
        invalidState = true;
        break;
      }

      const zone = detectReceiverZone([t2.x, t2.y, t2.z]);
      if (zone) {
        if (receiverEntered == null) receiverEntered = zone;
        if (speed <= SETTLE_LINEAR_SPEED_MPS && ang <= SETTLE_ANGULAR_SPEED_RAD_S) {
          settleAccum += PHYSICS_TIMESTEP_SEC;
        } else {
          settleAccum = Math.max(0, settleAccum - PHYSICS_TIMESTEP_SEC * 0.25);
        }
        if (settleAccum >= SETTLE_DURATION_SEC) break;
        if (i * PHYSICS_TIMESTEP_SEC > 8 && speed < 0.4) break;
      }

      if (
        t2.x > runtimeWorldContactPlaneS() - 0.2
        && t2.x < runtimeWorldClearPlaneS() + 0.5
        && !zone
      ) {
        // C/D progress is often lateral along the guide — track |Δx|+|Δz|.
        const progress = Math.abs(t2.x - lastProgressX) + Math.abs(t2.z - lastProgressZ);
        if (progress < 0.0015) stuckClock += PHYSICS_TIMESTEP_SEC;
        else {
          stuckClock = 0;
          lastProgressX = t2.x;
          lastProgressZ = t2.z;
        }
        if (stuckClock >= STUCK_TIMEOUT_SEC) {
          stuck = true;
          break;
        }
      } else {
        stuckClock = 0;
        lastProgressX = t2.x;
        lastProgressZ = t2.z;
      }
    }

    const t = body.translation();
    const finalPosition: [number, number, number] = [t.x, t.y, t.z];
    if (!receiverEntered) receiverEntered = detectReceiverZone(finalPosition);
    const correctReceiver = receiverEntered === category;

    let failure: JunctionFailure | null = null;
    if (invalidState) failure = 'INVALID_TRANSFORM';
    else if (contactWhileOpening > 0) failure = 'DIVERTER_CONTACT_WHILE_OPENING';
    else if (tunnelling) failure = 'PRODUCT_TUNNELLED_THROUGH_GUIDE';
    else if (stuck) failure = 'PRODUCT_STUCK_IN_JUNCTION';
    else if (receiverEntered && receiverEntered !== category) failure = 'WRONG_RECEIVER_ENTRY';
    else if (!correctReceiver) failure = 'MISSED_RECEIVER';

    return {
      skuId,
      expectedZone: category,
      physicalRoute: route,
      finalPosition,
      receiverEntered,
      correctReceiver,
      contactCount,
      contactWhileOpening,
      maxSpeedMps: maxSpeed,
      maxAngularSpeed: maxAng,
      stuck,
      tunnelling,
      invalidState,
      failure,
      stepsSimulated: steps,
      lateralDisplacement: finalPosition[2],
    };
  } finally {
    world.free();
  }
}

export const JUNCTION_MATRIX_PROFILES = {
  // Stable rect / light rect / thin difficult (pen).
  B: ['SKU-001', 'SKU-002', 'SKU-009'] as const,
  // Stable rect / corridor cylinder / tall capsule.
  C: ['SKU-001', 'SKU-005', 'SKU-007'] as const,
  // Flat pack / tall capsule / standing cylinder.
  D: ['SKU-006', 'SKU-007', 'SKU-008'] as const,
};

export function runJunctionMatrix(runsPerProfile = 5): {
  total: number;
  passed: number;
  results: JunctionRunResult[];
} {
  const results: JunctionRunResult[] = [];
  for (const route of ['B', 'C', 'D'] as const) {
    for (const sku of JUNCTION_MATRIX_PROFILES[route]) {
      for (let i = 0; i < runsPerProfile; i += 1) {
        results.push(simulateJunctionContact(sku, route));
      }
    }
  }
  const passed = results.filter((r) => r.correctReceiver && r.failure == null).length;
  return { total: results.length, passed, results };
}
