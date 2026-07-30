/**
 * Stage 2C §11.1 — machine-readable runtime ↔ headless physics config hash.
 * Both paths must consume the same static colliders, pusher geometry, dt, gravity.
 * Hash is pure-JS (no Node crypto) so the module stays isomorphic.
 */
import { getStaticColliders } from './physicsWorldLayout';
import { PUSHER } from './pusherMotion';
import { PHYSICS_TIMESTEP_SEC, PHYSICS_GRAVITY } from './physicsTimestep';

export { PHYSICS_TIMESTEP_SEC, PHYSICS_GRAVITY } from './physicsTimestep';

export interface PhysicsConfigSnapshot {
  timestep: number;
  gravity: [number, number, number];
  pusherHalfExtents: [number, number, number];
  pusherCenterY: number;
  pusherEngage: { x: number; z: number };
  staticColliderCount: number;
  staticColliderIds: string[];
  staticColliderFingerprint: string;
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

export function buildPhysicsConfigSnapshot(timestep: number): PhysicsConfigSnapshot {
  const defs = getStaticColliders();
  return {
    timestep,
    gravity: PHYSICS_GRAVITY,
    pusherHalfExtents: [...PUSHER.halfExtents] as [number, number, number],
    pusherCenterY: PUSHER.centerY,
    pusherEngage: { x: PUSHER.engageX, z: PUSHER.engageZ },
    staticColliderCount: defs.length,
    staticColliderIds: defs.map((d) => d.id),
    staticColliderFingerprint: fingerprintColliders(),
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
