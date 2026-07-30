/**
 * Stage 2 §11/§18 — headless drop simulator (Node / vitest, no React).
 *
 * Reproduces EXACTLY the runtime physics handoff from
 * PhysicalPlaybackItemPhysics:
 *   same static colliders (domain/physicsWorldLayout),
 *   same per-SKU colliders + density + friction + restitution (visualPhysicsProfiles),
 *   same handoff pose (getPhysicalItemPose at the same handoff fraction),
 *   same deterministic initial velocities,
 *   same settle rule (sleep or controlled timeout) and the same
 *   domain-receiver verification (receiverVolumes).
 *
 * Deterministic: fixed timestep 1/60, identical initial conditions, no RNG.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { getStaticColliders } from './physicsWorldLayout';
import { getVisualPhysicsProfile, type VisualPhysicsProfile } from './visualPhysicsProfiles';
import { getPhysicalItemPose, getDropHandoffTimeMs } from './physicalItemMotion';
import { getPusherState, PUSHER } from './pusherMotion';
import { receiverContains, type ReceiverZone } from './receiverVolumes';
import { resolveItem } from '../data/resolveItem';
import { BELT_TOP_Y } from './physicalLayout';
import { PHYSICS_TIMESTEP_SEC } from './physicsTimestep';

export const SIM_DT = PHYSICS_TIMESTEP_SEC;
export const SIM_SETTLE_SECONDS = 6.0;

let rapierReady = false;
export async function initRapier(): Promise<void> {
  if (!rapierReady) {
    await RAPIER.init();
    rapierReady = true;
  }
}

type Quat = { x: number; y: number; z: number; w: number };

/** three.js Euler XYZ order → quaternion (same math as THREE.Quaternion.setFromEuler). */
function quatFromEuler(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2); const c2 = Math.cos(y / 2); const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2); const s2 = Math.sin(y / 2); const s3 = Math.sin(z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

function colliderDescFor(profile: VisualPhysicsProfile): RAPIER.ColliderDesc {
  let desc: RAPIER.ColliderDesc;
  if (profile.collider === 'cuboid' && profile.cuboidHalfExtents) {
    const [hx, hy, hz] = profile.cuboidHalfExtents;
    desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    desc.setDensity(profile.approximateMassKg / (8 * hx * hy * hz));
  } else if (profile.collider === 'capsule' && profile.capsule) {
    const [r, hh] = profile.capsule;
    desc = RAPIER.ColliderDesc.capsule(hh, r);
    desc.setDensity(profile.approximateMassKg / (Math.PI * r * r * (2 * hh + (4 / 3) * r)));
  } else {
    const [r, hh] = profile.capsule ?? [0.05, 0.1];
    desc = RAPIER.ColliderDesc.cylinder(hh, r);
    desc.setDensity(profile.approximateMassKg / (Math.PI * r * r * 2 * hh));
  }
  if (profile.colliderAxis === 'x') {
    // Rapier capsule/cylinder axis is Y by default — rotate to lie along X.
    desc.setRotation(quatFromEuler(0, 0, Math.PI / 2));
  }
  desc.setFriction(profile.friction);
  desc.setRestitution(profile.restitution);
  return desc;
}

/** Handoff state mirroring PhysicalPlaybackItemPhysics: same pose, same velocities. */
function handoffState(skuId: string, category: ReceiverZone) {
  const profile = getVisualPhysicsProfile(skuId);
  const item = resolveItem(skuId);
  const handoffMs = getDropHandoffTimeMs(category, undefined);
  if (handoffMs == null) throw new Error(`no handoff for ${skuId}/${category}`);
  const pose = getPhysicalItemPose({
    caseId: `sim_${skuId}_${category}`,
    slotIndex: 0,
    dimensionsMm: item.dimensionsMm,
    targetCategory: category,
    elapsedMs: handoffMs,
    faultType: undefined,
  });
  const h = item.dimensionsMm.height / 1000;
  // B: belt carry-over off the spur edge. C/D: belt carry at the junction —
  // Z motion comes from the kinematic pusher plate CONTACT (Stage 2B §13).
  const linvel = { x: 1.0, y: 0, z: 0 };
  const angvel = profile.canRoll && category === 'B'
    ? { x: 2.0, y: 0.4, z: 0 }
    : { x: 0, y: 0, z: 0 };
  return { profile, pose, linvel, angvel, itemHeightM: h };
}

export interface DropSimResult {
  skuId: string;
  expectedZone: ReceiverZone;
  finalPosition: [number, number, number];
  finalQuaternion: [number, number, number, number];
  insideExpectedReceiver: boolean;
  settledBySleep: boolean;
  settledByTimeout: boolean;
  stepsSimulated: number;
  /** Physics engine confirmed contact between the pusher plate and the item. */
  pusherContactMade: boolean;
  /** Lowest belt/floor clearance observed (translation.y - itemHalfHeight). */
  minClearanceM: number;
  /** Integrated |angvel| over the drop — distinguishes rolling from teleport-like slides. */
  totalRotationRad: number;
  /** Max speed during flight — proves ballistic motion, not teleportation. */
  maxSpeedMps: number;
}

export function simulateDrop(
  skuId: string,
  category: ReceiverZone,
  overrides?: {
    linvelScale?: number;
    /** Fault injection: pusher executes the OPPOSITE side (mechanism fault). */
    wrongPusher?: boolean;
    trace?: (sample: {
    t: number; x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    wx: number; wy: number; wz: number; sleeping: boolean;
  }) => void },
): DropSimResult {
  const { profile, pose, linvel, angvel, itemHeightM } = handoffState(skuId, category);
  const scale = overrides?.linvelScale ?? 1;

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = SIM_DT;
  try {
    for (const c of getStaticColliders()) {
      const q = quatFromEuler(c.rotation[0], c.rotation[1], c.rotation[2]);
      const desc = RAPIER.ColliderDesc.cuboid(c.halfExtents[0], c.halfExtents[1], c.halfExtents[2])
        .setTranslation(c.position[0], c.position[1], c.position[2])
        .setRotation(q)
        .setFriction(c.friction);
      world.createCollider(desc);
    }

    const q = quatFromEuler(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pose.position[0], pose.position[1], pose.position[2])
      .setRotation(q)
      .setLinvel(linvel.x * scale, linvel.y * scale, linvel.z * scale)
      .setAngvel(angvel)
      .setLinearDamping(profile.linearDamping)
      .setAngularDamping(profile.angularDamping)
      .setCcdEnabled(profile.approximateMassKg < 0.05 || itemHeightM < 0.05); // pen + thin plate
    const body = world.createRigidBody(bodyDesc);
    const itemCollider = world.createCollider(colliderDescFor(profile), body);

    // Kinematic sorting pusher (C/D routes): physically contacts the item
    // and drives it across the belt onto the chute — mirrors the runtime body.
    let pusherBody: RAPIER.RigidBody | null = null;
    let pusherCollider: RAPIER.Collider | null = null;
    const pusherCategory = overrides?.wrongPusher && category !== 'B'
      ? (category === 'C' ? 'D' : 'C')
      : category;
    if (category !== 'B') {
      const initial = getPusherState(pusherCategory, 0);
      pusherBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(initial.x, PUSHER.centerY, initial.z)
          .setRotation(quatFromEuler(0, initial.yaw, 0)),
      );
      pusherCollider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(...PUSHER.halfExtents).setFriction(0.15),
        pusherBody,
      );
    }
    let pusherContactMade = false;

    // Clearance is measured against the collider's SMALLEST vertical
    // half-extent, not itemHeightM/2 — a bottle lying on its side legitimately
    // has its center ~r above the floor, 10× less than its standing half-height.
    const halfH = profile.collider === 'cuboid' && profile.cuboidHalfExtents
      ? Math.min(...profile.cuboidHalfExtents)
      : (profile.capsule?.[0] ?? itemHeightM / 2);
    let minClearance = Infinity;
    let totalRotation = 0;
    let maxSpeed = 0;
    let steps = 0;
    let slept = false;
    const maxSteps = Math.round(SIM_SETTLE_SECONDS / SIM_DT);
    for (let i = 0; i < maxSteps; i += 1) {
      if (pusherBody && pusherCollider) {
        const ps = getPusherState(pusherCategory, i * SIM_DT);
        pusherBody.setNextKinematicTranslation({ x: ps.x, y: PUSHER.centerY, z: ps.z });
        pusherBody.setNextKinematicRotation(quatFromEuler(0, ps.yaw, 0));
      }
      world.step();
      steps += 1;
      if (pusherCollider && !pusherContactMade) {
        world.contactPairsWith(pusherCollider, (other) => {
          if (other.handle === itemCollider.handle) pusherContactMade = true;
        });
      }
      const t = body.translation();
      const v = body.linvel();
      const w = body.angvel();
      overrides?.trace?.({
        t: i * SIM_DT, x: t.x, y: t.y, z: t.z,
        vx: v.x, vy: v.y, vz: v.z, wx: w.x, wy: w.y, wz: w.z,
        sleeping: body.isSleeping(),
      });
      minClearance = Math.min(minClearance, t.y - halfH);
      totalRotation += Math.hypot(w.x, w.y, w.z) * SIM_DT;
      maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z));
      if (i > 12 && body.isSleeping()) { slept = true; break; }
    }

    const t = body.translation();
    const r = body.rotation();
    const p: [number, number, number] = [t.x, t.y, t.z];
    return {
      skuId,
      expectedZone: category,
      finalPosition: p,
      finalQuaternion: [r.x, r.y, r.z, r.w],
      insideExpectedReceiver: receiverContains(category, p),
      settledBySleep: slept,
      settledByTimeout: !slept,
      stepsSimulated: steps,
      pusherContactMade,
      minClearanceM: minClearance,
      totalRotationRad: totalRotation,
      maxSpeedMps: maxSpeed,
    };
  } finally {
    world.free();
  }
}

/** Drop starting height above the belt (for reporting). */
export { BELT_TOP_Y };
