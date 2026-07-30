/**
 * Stage 2D — SPEC_DERIVED_CAD angled paddle diverter.
 *
 * Visual: public/models/sorter/mechanism-web.glb built from
 * 3d_models/sorter_mechanism.step + tools/stage2d-mechanism (documented dims).
 * NOT author FreeCAD — see docs/stage2d/mechanism-cad-report.md.
 *
 * Physics: same kinematic cuboid as domain PUSHER (parity with headless).
 */
import { memo, Suspense, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getPusherState, PUSHER } from '../../domain/pusherMotion';
import { physicsSimClock } from './SorterPhysics';
import type { Category } from '../../domain/types';

export const MECHANISM_CAD_URL = '/models/sorter/mechanism-web.glb';
export const MECHANISM_SOURCE_STATUS = 'SPEC_DERIVED_CAD' as const;

function MechanismCadMesh({ castShadow }: { castShadow: boolean }) {
  const gltf = useLoader(GLTFLoader, MECHANISM_CAD_URL);
  const root = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const steel = new THREE.MeshStandardMaterial({
      color: '#8a949e', metalness: 0.85, roughness: 0.35,
      transparent: false, opacity: 1, depthWrite: true,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#3a4046', metalness: 0.9, roughness: 0.3,
      transparent: false, opacity: 1, depthWrite: true,
    });
    const yellow = new THREE.MeshStandardMaterial({
      color: '#f5c518', metalness: 0.25, roughness: 0.45,
      transparent: false, opacity: 1, depthWrite: true,
    });
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const n = mesh.name || '';
      if (n.includes('leading')) mesh.material = yellow;
      else if (n.includes('servo') || n.includes('housing') || n.includes('rib')) mesh.material = dark;
      else mesh.material = steel;
      // Only the plate casts — keep shadow budget low
      mesh.castShadow = castShadow && (n.includes('paddle') || n.includes('leading'));
      mesh.receiveShadow = castShadow;
    });
    return scene;
  }, [gltf, castShadow]);
  return <primitive object={root} />;
}

/** JSX fallback only if GLB fails to load — not the default. */
function MechanismJsxFallback({ castShadow }: { castShadow: boolean }) {
  const [hx, hy, hz] = PUSHER.halfExtents;
  return (
    <group>
      <mesh castShadow={castShadow} position={[0, 0, -hz - 0.002]}>
        <boxGeometry args={[hx * 2, hy * 2, 0.004]} />
        <meshStandardMaterial color="#f5c518" metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh castShadow={castShadow}>
        <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
        <meshStandardMaterial color="#8a949e" metalness={0.85} roughness={0.35} />
      </mesh>
    </group>
  );
}

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
        source: MECHANISM_SOURCE_STATUS,
      };
    }
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
      <Suspense fallback={<MechanismJsxFallback castShadow={castShadow} />}>
        <MechanismCadMesh castShadow={castShadow} />
      </Suspense>
    </RigidBody>
  );
});
