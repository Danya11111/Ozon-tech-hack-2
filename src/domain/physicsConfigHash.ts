/**
 * Stage 2C/2E — machine-readable runtime ↔ headless physics config hash.
 * Both paths must consume the same static colliders, pusher geometry, dt, gravity.
 * Hash is pure-JS (no Node crypto) so the module stays isomorphic.
 */
import { getStaticColliders } from './physicsWorldLayout';
import { PUSHER } from './pusherMotion';
import {
  PHYSICS_TIMESTEP_SEC,
  PHYSICS_GRAVITY,
  PHYSICS_MAX_SUBSTEPS,
} from './physicsTimestep';
import { allVisualPhysicsProfiles } from './visualPhysicsProfiles';
import { SIM_SETTLE_SECONDS } from './physicsDropSim';
import { B_RECEIVER, ROLL_CAGE, ZONES } from './physicalLayout';

export {
  PHYSICS_TIMESTEP_SEC,
  PHYSICS_GRAVITY,
  PHYSICS_MAX_SUBSTEPS,
} from './physicsTimestep';

export interface PhysicsConfigSnapshot {
  timestep: number;
  maxSubsteps: number;
  gravity: [number, number, number];
  settleSeconds: number;
  pusherHalfExtents: [number, number, number];
  pusherCenterY: number;
  pusherEngage: { x: number; z: number };
  pusherTiming: {
    strokeLength: number;
    strokeSpeed: number;
    armDelaySec: number;
    holdSec: number;
    retractSpeed: number;
    homeDistance: number;
  };
  staticColliderCount: number;
  staticColliderIds: string[];
  staticColliderFingerprint: string;
  skuPhysicsFingerprint: string;
  receiverFingerprint: string;
}

function fingerprintColliders(): string {
  const defs = getStaticColliders();
  return defs
    .map((d) =>
      [
        d.id,
        d.halfExtents.map((n) => n.toFixed(5)).join(','),
        d.position.map((n) => n.toFixed(5)).join(','),
        d.rotation.map((n) => n.toFixed(5)).join(','),
        d.friction.toFixed(4),
      ].join('|'),
    )
    .join(';');
}

/** FNV-1a 64-bit (as hex) — deterministic, isomorphic. */
function fnv1aHex(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

function fingerprintSkus(): string {
  return allVisualPhysicsProfiles()
    .map((p) =>
      [
        p.sku,
        p.approximateMassKg,
        p.friction,
        p.restitution,
        p.linearDamping,
        p.angularDamping,
        p.collider,
        p.colliderAxis ?? 'y',
        (p.cuboidHalfExtents ?? []).map((n) => n.toFixed(5)).join(','),
        (p.capsule ?? []).map((n) => n.toFixed(5)).join(','),
        p.centerOfMassOffsetY,
        p.pusherImpulseScale,
        p.canRoll ? 1 : 0,
      ].join('|'),
    )
    .join(';');
}

function fingerprintReceivers(): string {
  return [
    `B:${B_RECEIVER.centerX},${B_RECEIVER.centerZ},${B_RECEIVER.width},${B_RECEIVER.depth}`,
    `C:${ZONES.C.x},${ZONES.C.z},${ROLL_CAGE.width},${ROLL_CAGE.depth}`,
    `D:${ZONES.D.x},${ZONES.D.z},${ROLL_CAGE.width},${ROLL_CAGE.depth}`,
  ].join('|');
}

export function buildPhysicsConfigSnapshot(timestep: number): PhysicsConfigSnapshot {
  const defs = getStaticColliders();
  return {
    timestep,
    maxSubsteps: PHYSICS_MAX_SUBSTEPS,
    gravity: PHYSICS_GRAVITY,
    settleSeconds: SIM_SETTLE_SECONDS,
    pusherHalfExtents: [...PUSHER.halfExtents] as [number, number, number],
    pusherCenterY: PUSHER.centerY,
    pusherEngage: { x: PUSHER.engageX, z: PUSHER.engageZ },
    pusherTiming: {
      strokeLength: PUSHER.strokeLength,
      strokeSpeed: PUSHER.strokeSpeed,
      armDelaySec: PUSHER.armDelaySec,
      holdSec: PUSHER.holdSec,
      retractSpeed: PUSHER.retractSpeed,
      homeDistance: PUSHER.homeDistance,
    },
    staticColliderCount: defs.length,
    staticColliderIds: defs.map((d) => d.id),
    staticColliderFingerprint: fingerprintColliders(),
    skuPhysicsFingerprint: fingerprintSkus(),
    receiverFingerprint: fingerprintReceivers(),
  };
}

export function hashPhysicsConfig(snapshot: PhysicsConfigSnapshot): string {
  return fnv1aHex(JSON.stringify(snapshot));
}

export function getRuntimePhysicsConfigHash(): string {
  return hashPhysicsConfig(buildPhysicsConfigSnapshot(PHYSICS_TIMESTEP_SEC));
}

export function getHeadlessPhysicsConfigHash(headlessTimestep = PHYSICS_TIMESTEP_SEC): string {
  return hashPhysicsConfig(buildPhysicsConfigSnapshot(headlessTimestep));
}

export function assertRuntimeHeadlessParity(headlessTimestep = PHYSICS_TIMESTEP_SEC): {
  runtime: string;
  headless: string;
  equal: boolean;
  timestepEqual: boolean;
} {
  const runtime = getRuntimePhysicsConfigHash();
  const headless = getHeadlessPhysicsConfigHash(headlessTimestep);
  return {
    runtime,
    headless,
    equal: runtime === headless,
    timestepEqual: headlessTimestep === PHYSICS_TIMESTEP_SEC,
  };
}
