/**
 * Junction rotary guide gates — two light-gray vanes at JUNCTION.
 *
 * Invented sorter drive assets (mechanism-final / mechanism-mount motors,
 * servos, paddle) are not loaded. Each vane shares one kinematic RigidBody
 * for visible mesh + collider (same pivot, position, quaternion).
 */
import { memo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import {
  GATE_VANE,
  getGateState,
  gateOpenLeadSec,
} from '../../domain/pusherMotion';
// GATE_VANE used for gateShot hold snapshot timing
import { JUNCTION } from '../../domain/physicalLayout';
import { getRoutingStartMs } from '../../domain/physicalItemMotion';
import { physicsSimClock } from './SorterPhysics';
import type { Category } from '../../domain/types';

export const MECHANISM_SOURCE_STATUS = 'JUNCTION_ROTARY_GATES' as const;
export const MECHANISM_CAD_URL = '/models/sorter/mechanism-final.glb';
export const MECHANISM_MOUNT_URL = '/models/sorter/mechanism-mount-final.glb';

const VANE_COLOR = '#e6ebf0';

type YawRefs = { left: number; right: number };

function GateVaneBody({
  side,
  yawRefs,
  castShadow,
}: {
  side: 'left' | 'right';
  yawRefs: MutableRefObject<YawRefs>;
  castShadow: boolean;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const pivot = side === 'left' ? JUNCTION.leftPivot : JUNCTION.rightPivot;
  const [hx, hy, hz] = GATE_VANE.halfExtents;

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;
    const yawRad = side === 'left' ? yawRefs.current.left : yawRefs.current.right;
    const x = pivot.x + Math.cos(yawRad) * hx;
    const y = GATE_VANE.centerY;
    const z = pivot.z + Math.sin(yawRad) * hx;
    body.setNextKinematicTranslation({ x, y, z });
    const half = yawRad / 2;
    body.setNextKinematicRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      friction={0.35}
      position={[pivot.x + hx, GATE_VANE.centerY, pivot.z]}
    >
      <CuboidCollider args={[hx, hy, hz]} />
      <mesh castShadow={castShadow} receiveShadow={castShadow}>
        <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
        <meshStandardMaterial
          color={VANE_COLOR}
          metalness={0.35}
          roughness={0.45}
          transparent={false}
          opacity={1}
          depthWrite
        />
      </mesh>
    </RigidBody>
  );
}

/** Invented sorter mount / motors — not rendered (GLBs not loaded). */
export const MechanismMount = memo(function MechanismMount(_props: {
  castShadow?: boolean;
}) {
  return null;
});

export const PusherMechanism = memo(function PusherMechanism({
  category,
  routingElapsedMs,
  caseElapsedMs,
  castShadow = false,
}: {
  category: Category | null;
  routingElapsedMs: number;
  caseElapsedMs?: number;
  castShadow?: boolean;
}) {
  const yawRefs = useRef<YawRefs>({ left: 0, right: 0 });
  const hudRef = useRef<HTMLDivElement>(null);
  const routeCat: 'B' | 'C' | 'D' | null =
    category === 'B' || category === 'C' || category === 'D' ? category : null;

  useFrame(() => {
    const routingStartMs = getRoutingStartMs();
    const leadMs = gateOpenLeadSec() * 1000;
    const openAtMs = routingStartMs - leadMs;
    const elapsedCase = caseElapsedMs ?? routingElapsedMs + routingStartMs;
    const gateTimelineSec = (elapsedCase - openAtMs) / 1000;
    // ?gateShot=1 freezes the active divert pose at 45° for visual verification.
    const gateShot = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('gateShot') === '1';
    const state = gateShot && routeCat && routeCat !== 'B'
      ? getGateState(routeCat, GATE_VANE.swingSec + 0.05)
      : getGateState(routeCat, gateTimelineSec);
    yawRefs.current.left = state.leftYawRad;
    yawRefs.current.right = state.rightYawRad;

    if (hudRef.current) {
      hudRef.current.textContent =
        `L ${Math.round(state.leftDeg)}° / R ${Math.round(state.rightDeg)}°`;
    }

    if (typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('trace') === '1') {
      (window as unknown as { __GATE_STATE?: unknown }).__GATE_STATE = {
        mode: state.mode,
        phase: state.phase,
        leftDeg: state.leftDeg,
        rightDeg: state.rightDeg,
        junction: { x: JUNCTION.x, y: JUNCTION.y, z: JUNCTION.z },
        simSec: physicsSimClock.simSec,
        source: MECHANISM_SOURCE_STATUS,
      };
    }
    (window as unknown as { __GATE_ANGLES?: { left: number; right: number } }).__GATE_ANGLES = {
      left: Math.round(state.leftDeg),
      right: Math.round(state.rightDeg),
    };
  });

  return (
    <group name="junction-guide-gates">
      <GateVaneBody side="left" yawRefs={yawRefs} castShadow={castShadow} />
      <GateVaneBody side="right" yawRefs={yawRefs} castShadow={castShadow} />
      <Html position={[JUNCTION.x, JUNCTION.y + 0.45, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          ref={hudRef}
          style={{
            color: '#e2e8f0',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '13px',
            fontWeight: 700,
            textShadow: '0 1px 3px #000',
            whiteSpace: 'nowrap',
          }}
        >
          L 0° / R 0°
        </div>
      </Html>
    </group>
  );
});
