/**
 * Physics world for the sorter — single step authority via @react-three/rapier.
 *
 * Physics is mounted `paused` so FrameStepper does not auto-step. RapierStepper
 * is the only caller of context.step(), which runs before/after hooks, fixed
 * substeps, and mesh sync. Playback speed scales the clamped frame delta.
 */
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Physics,
  RigidBody,
  CuboidCollider,
  useRapier,
  useAfterPhysicsStep,
} from '@react-three/rapier';
import { getStaticColliders } from '../../domain/physicsWorldLayout';
import {
  PHYSICS_TIMESTEP_SEC,
  PHYSICS_MAX_SUBSTEPS,
  MAX_FRAME_DELTA_SEC,
  PHYSICS_GRAVITY,
} from '../../domain/physicsTimestep';
import {
  PhysicsPerfSampler,
  isPhysicsPerfQueryEnabled,
  type PhysicsPerfSnapshot,
} from '../../domain/physicsPerf';

export const PHYSICS_DT = PHYSICS_TIMESTEP_SEC;
export { PHYSICS_MAX_SUBSTEPS };
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
    __CONVEYOR_PHYSICS_DEBUG__?: Record<string, unknown>;
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

/**
 * Sole physics-step authority: calls Rapier context.step (not raw world.step)
 * so before/after hooks and rigid-body mesh sync run once per substep batch.
 */
function PhysicsSimClock() {
  useAfterPhysicsStep(() => {
    physicsSimClock.simSec += PHYSICS_DT;
  });
  return null;
}

function RapierStepper({ running, speed }: { running: boolean; speed: number }) {
  const { step, world } = useRapier();
  const wasRunning = useRef(false);
  const sampler = useRef(new PhysicsPerfSampler(PHYSICS_DT, MAX_SUBSTEPS));
  const perfOn = useRef(false);
  const stepsThisFrame = useRef(0);

  if (typeof window !== 'undefined' && !perfOn.current) {
    perfOn.current = isPhysicsPerfQueryEnabled();
    if (perfOn.current) {
      window.__PHYSICS_PERF_RESET__ = () => sampler.current.reset();
    }
  }

  useFrame((_, delta) => {
    if (!running) {
      // Pause: do not step; do not accumulate paused wall-clock time.
      wasRunning.current = false;
      return;
    }

    // On resume, ignore the (possibly huge) first frame delta.
    const frameDelta = wasRunning.current
      ? Math.min(delta, MAX_FRAME_DELTA_SEC)
      : Math.min(delta, PHYSICS_DT);
    wasRunning.current = true;

    const scaled = frameDelta * speed;
    const capped = Math.min(scaled, MAX_SUBSTEPS * PHYSICS_DT);
    const simBefore = physicsSimClock.simSec;
    const before = performance.now();
    step(capped);
    const steps = Math.max(
      0,
      Math.round((physicsSimClock.simSec - simBefore) / PHYSICS_DT),
    );
    stepsThisFrame.current = steps;
    if (perfOn.current && steps > 0) {
      sampler.current.pushStepMs(performance.now() - before, steps);
      window.__PHYSICS_PERF__ = sampler.current.snapshot(readWorldMeta(world));
    }
  });
  return null;
}

/** Static colliders for the whole working area (fixed bodies, cheap cuboids). */
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
    <Physics
      updateLoop="independent"
      paused
      timeStep={PHYSICS_DT}
      gravity={PHYSICS_GRAVITY}
      interpolate={false}
    >
      <PhysicsSimClock />
      <RapierStepper running={running} speed={speed} />
      <SorterStaticColliders />
      {children}
    </Physics>
  );
}
