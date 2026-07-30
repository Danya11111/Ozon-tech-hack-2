/**
 * Stage 2B §13 — angled paddle diverter (sorting mechanism).
 *
 * ONE component = visual paddle + kinematic rigid body with the SAME plate
 * geometry, driven by the SAME pure domain function getPusherState()
 * (also used by the headless validation sim) — visual and collider can never
 * drift apart. The paddle physically contacts items and drives them across
 * the belt onto the gravity chute; no timer-only teleport into the chute.
 *
 * SPEC_DERIVED: angled paddle diverter, 1000×280mm face, pneumatic cylinder,
 * linear guide rail, safety-yellow moving parts.
 */
import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import { getPusherState, PUSHER } from '../../domain/pusherMotion';
import { physicsSimClock } from './SorterPhysics';
import type { Category } from '../../domain/types';

const STEEL = '#8a949e';
const DARK_STEEL = '#3a4046';
const SAFETY_YELLOW = '#f5c518';

export const PusherMechanism = memo(function PusherMechanism({
  category,
  routingElapsedMs,
  castShadow = false,
}: {
  category: Category | null;
  routingElapsedMs: number;
  castShadow?: boolean;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const traceEnabled = useRef(
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('trace') === '1',
  );
  // Physics-time zero point: latched the frame routing starts. The paddle is
  // driven by physicsSimClock (steps actually executed), so paddle velocity
  // stays physically correct even when render lag makes domain time race ahead.
  const startSimSecRef = useRef<number | null>(null);
  const route: 'B' | 'C' | 'D' | null =
    category === 'C' || category === 'D' ? category : null;

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (route && routingElapsedMs > 0) {
      if (startSimSecRef.current == null) startSimSecRef.current = physicsSimClock.simSec;
    } else {
      startSimSecRef.current = null;
    }
    const elapsedSec = startSimSecRef.current != null
      ? physicsSimClock.simSec - startSimSecRef.current
      : 0;
    const state = getPusherState(route, elapsedSec);
    body.setNextKinematicTranslation({ x: state.x, y: PUSHER.centerY, z: state.z });
    if (traceEnabled.current) {
      (window as unknown as { __PUSHER_STATE?: unknown }).__PUSHER_STATE = {
        t: elapsedSec, phase: state.phase, x: state.x, z: state.z, simSec: physicsSimClock.simSec,
      };
    }
    // yaw = ±PUSHER.yaw about Y (paddle face perpendicular to the diagonal)
    const half = state.yaw / 2;
    body.setNextKinematicRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
  });

  const [hx, hy, hz] = PUSHER.halfExtents;
  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      friction={0.15}
    >
      <CuboidCollider args={[hx, hy, hz]} />
      {/* Paddle face — safety yellow leading edge strip */}
      <mesh castShadow={castShadow} position={[0, 0, -hz - 0.002]}>
        <boxGeometry args={[hx * 2, hy * 2, 0.004]} />
        <meshStandardMaterial color={SAFETY_YELLOW} metalness={0.25} roughness={0.45} />
      </mesh>
      {/* Paddle plate */}
      <mesh castShadow={castShadow}>
        <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
        <meshStandardMaterial color={STEEL} metalness={0.85} roughness={0.35} />
      </mesh>
      {/* Stiffener ribs on the back of the plate */}
      {[-0.3, 0, 0.3].map((ox) => (
        <mesh key={ox} castShadow={castShadow} position={[ox, 0, hz + 0.015]}>
          <boxGeometry args={[0.04, hy * 2, 0.03]} />
          <meshStandardMaterial color={DARK_STEEL} metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      {/* Pneumatic cylinder housing behind the plate */}
      <mesh castShadow={castShadow} position={[0, hy - 0.02, hz + 0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.16, 20]} />
        <meshStandardMaterial color={DARK_STEEL} metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, hy - 0.02, hz + 0.19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 14]} />
        <meshStandardMaterial color={STEEL} metalness={0.95} roughness={0.2} />
      </mesh>
    </RigidBody>
  );
});
