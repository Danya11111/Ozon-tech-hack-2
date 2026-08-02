/**
 * Stage 2 — physics world for the sorter drop segment.
 *
 * Hybrid authority (docs/stage2_real_sorter/physics-architecture.md):
 *  - items on the belt are KINEMATIC (domain pose is truth);
 *  - at the drop handoff (pusher contact / belt edge) the body switches to
 *    DYNAMIC with deterministic initial velocity;
 *  - static colliders mirror the visible chute / receiver geometry
 *    (documented hidden colliders, same dimensions as the visuals).
 *
 * Determinism: fixed dt = 1/60, max 4 substeps/frame, no unseeded randomness.
 * Physics freezes when the domain clock is paused (documented simulation
 * assumption — belt, gate and items halt together; EMERGENCY_STOP creates no
 * new impulses).
 *
 * Stage 2E: Rapier step timing via PhysicsPerfSampler (?perf=1 | ?physicsPerf=1).
 * Render time is NOT included in physics p95.
 */
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { getStaticColliders } from '../../domain/physicsWorldLayout';
import { PHYSICS_TIMESTEP_SEC } from '../../domain/physicsTimestep';
import {
  PhysicsPerfSampler,
  isPhysicsPerfQueryEnabled,
  type PhysicsPerfSnapshot,
} from '../../domain/physicsPerf';

export const PHYSICS_DT = PHYSICS_TIMESTEP_SEC;
export const PHYSICS_MAX_SUBSTEPS = 4;
const MAX_SUBSTEPS = PHYSICS_MAX_SUBSTEPS;

/**
 * Physics-time clock (seconds actually simulated by THIS world instance).
 * Kinematic mechanisms must be driven by this clock — never by the domain
 * wall clock — because under render lag the stepper burns at most
 * MAX_SUBSTEPS per frame and physics time falls behind domain time.
 */
export const physicsSimClock = { simSec: 0 };

export function resetPhysicsSimClock() {
  physicsSimClock.simSec = 0;
}

/** Drop verification record (debug/e2e introspection, no secrets). */
export interface DropResult {
  caseId: string;
  itemId: string;
  expectedZone: 'B' | 'C' | 'D';
  finalPosition: [number, number, number];
  insideExpectedReceiver: boolean;
  settledByTimeout: boolean;
  timestampMs: number;
}

declare global {
  interface Window {
    __DROP_RESULTS?: DropResult[];
    __PHYSICS_PERF__?: PhysicsPerfSnapshot;
    __PHYSICS_PERF_RESET__?: () => void;
  }
}

export function recordDropResult(result: DropResult) {
  if (typeof window !== 'undefined') {
    window.__DROP_RESULTS = [...(window.__DROP_RESULTS ?? []).slice(-49), result];
  }
}

function readWorldMeta(world: {
  bodies?: { len: () => number };
  colliders?: { len: () => number };
}): { activeBodies: number; sleepingBodies: number; colliders: number; contactPairs: number } {
  try {
    // @react-three/rapier wraps Rapier world; body counts via forEach when available
    const w = world as unknown as {
      forEachRigidBody?: (cb: (b: { isSleeping: () => boolean; numColliders: () => number }) => void) => void;
      bodies?: { len: () => number };
      colliders?: { len: () => number };
    };
    let active = 0;
    let sleeping = 0;
    let colliders = 0;
    if (typeof w.forEachRigidBody === 'function') {
      w.forEachRigidBody((b) => {
        if (b.isSleeping()) sleeping += 1;
        else active += 1;
        try {
          colliders += b.numColliders();
        } catch {
          /* ignore */
        }
      });
    } else {
      active = w.bodies?.len?.() ?? 0;
      colliders = w.colliders?.len?.() ?? 0;
    }
    return { activeBodies: active, sleepingBodies: sleeping, colliders, contactPairs: 0 };
  } catch {
    return { activeBodies: 0, sleepingBodies: 0, colliders: 0, contactPairs: 0 };
  }
}

/** Steps the Rapier world with a fixed dt, scaled by domain playback speed. */
function RapierStepper({ running, speed }: { running: boolean; speed: number }) {
  const { world } = useRapier();
  const accumulator = useRef(0);
  const sampler = useRef(new PhysicsPerfSampler(PHYSICS_DT, MAX_SUBSTEPS));
  const perfOn = useRef(false);

  // Latch query once (and expose reset) — no React state.
  if (typeof window !== 'undefined' && !perfOn.current) {
    perfOn.current = isPhysicsPerfQueryEnabled();
    if (perfOn.current) {
      window.__PHYSICS_PERF_RESET__ = () => sampler.current.reset();
    }
  }

  useFrame((_, delta) => {
    if (!running) return;
    accumulator.current += Math.min(delta, 0.1) * speed;
    let steps = 0;
    let framePhysicsMs = 0;
    while (accumulator.current >= PHYSICS_DT && steps < MAX_SUBSTEPS) {
      if (perfOn.current) {
        const t0 = performance.now();
        world.step();
        framePhysicsMs += performance.now() - t0;
      } else {
        world.step();
      }
      physicsSimClock.simSec += PHYSICS_DT;
      accumulator.current -= PHYSICS_DT;
      steps += 1;
    }
    if (perfOn.current && steps > 0) {
      // Record per-frame physics cost (sum of substeps this frame), not render.
      sampler.current.pushStepMs(framePhysicsMs, steps);
      window.__PHYSICS_PERF__ = sampler.current.snapshot(readWorldMeta(world));
    }
    if (steps === MAX_SUBSTEPS) accumulator.current = 0;
  });
  return null;
}

/** Static colliders for the whole working area (fixed bodies, cheap cuboids).
 *  Layout data lives in domain/physicsWorldLayout — shared with headless tests. */
export function SorterStaticColliders() {
  return (
    <RigidBody type="fixed" colliders={false}>
      {getStaticColliders().map((c) => (
        <CuboidCollider
          key={c.id}
          args={c.halfExtents}
          position={c.position}
          rotation={c.rotation}
          friction={c.friction}
        />
      ))}
    </RigidBody>
  );
}

export function SorterPhysicsWorld({
  running,
  speed,
  children,
}: {
  running: boolean;
  speed: number;
  children: ReactNode;
}) {
  return (
    <Physics updateLoop="independent" paused timeStep={PHYSICS_DT} gravity={[0, -9.81, 0]}>
      <RapierStepper running={running} speed={speed} />
      <SorterStaticColliders />
      {children}
    </Physics>
  );
}
