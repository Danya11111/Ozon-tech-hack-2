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
 */
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import { getStaticColliders } from '../../domain/physicsWorldLayout';
import { PHYSICS_TIMESTEP_SEC } from '../../domain/physicsTimestep';

export const PHYSICS_DT = PHYSICS_TIMESTEP_SEC;
const MAX_SUBSTEPS = 4;

/**
 * Physics-time clock (seconds actually simulated by THIS world instance).
 * Kinematic mechanisms must be driven by this clock — never by the domain
 * wall clock — because under render lag the stepper burns at most
 * MAX_SUBSTEPS per frame and physics time falls behind domain time. Driving
 * the pusher from domain time made the paddle sweep through items in a few
 * huge jumps (visible as items being smashed/tunneled on slow devices).
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
  interface Window { __DROP_RESULTS?: DropResult[] }
}

export function recordDropResult(result: DropResult) {
  if (typeof window !== 'undefined') {
    window.__DROP_RESULTS = [...(window.__DROP_RESULTS ?? []).slice(-49), result];
  }
}

/** Steps the Rapier world with a fixed dt, scaled by domain playback speed. */
function RapierStepper({ running, speed }: { running: boolean; speed: number }) {
  const { world } = useRapier();
  const accumulator = useRef(0);
  const perfEnabled = useRef(
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('perf') === '1',
  );
  const samples = useRef<number[]>([]);
  useFrame((_, delta) => {
    if (!running) return;
    accumulator.current += Math.min(delta, 0.1) * speed;
    let steps = 0;
    while (accumulator.current >= PHYSICS_DT && steps < MAX_SUBSTEPS) {
      if (perfEnabled.current) {
        const t0 = performance.now();
        world.step();
        const ms = performance.now() - t0;
        samples.current.push(ms);
        if (samples.current.length > 600) samples.current.shift();
        const sorted = [...samples.current].sort((a, b) => a - b);
        (window as unknown as { __PHYSICS_PERF__?: unknown }).__PHYSICS_PERF__ = {
          count: samples.current.length,
          avgMs: samples.current.reduce((s, v) => s + v, 0) / samples.current.length,
          p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
          maxMs: sorted[sorted.length - 1] ?? 0,
        };
      } else {
        world.step();
      }
      physicsSimClock.simSec += PHYSICS_DT;
      accumulator.current -= PHYSICS_DT;
      steps += 1;
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
