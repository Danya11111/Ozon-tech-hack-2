/**
 * Product rigid body — physical conveyor + physical junction contact.
 *
 * Single dynamic body from spawn through receiver settle.
 * C/D redirection is contact-only against kinematic CAD diverter colliders.
 * No junction setTranslation / route-specific lateral impulses.
 */
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  RigidBody,
  CuboidCollider,
  CapsuleCollider,
  CylinderCollider,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from '@react-three/rapier';
import { RigidBodyType } from '@dimforge/rapier3d-compat';
import { getPhysicalItemPose } from '../../domain/physicalItemMotion';
import {
  getProductPhysicsProfile,
  colliderHalfHeight,
  spawnCenterY,
  isSupportedByBelt,
  computeBeltDriveForce,
  isInvalidProductState,
  recordInvalidProductState,
  BELT_SPEED_MPS,
  type ProductPhysicsPhase,
} from '../../domain/productPhysicsProfiles';
import {
  DOCUMENTED_CONTACT_PLANE_S,
  detectReceiverZone,
  SETTLE_LINEAR_SPEED_MPS,
  SETTLE_ANGULAR_SPEED_RAD_S,
  SETTLE_DURATION_SEC,
} from '../../domain/junctionContactPhysics';
import { resolveItem } from '../../data/resolveItem';
import { classifyItem } from '../../domain/classifier';
import { receiverContains } from '../../domain/receiverVolumes';
import type { PlaylistCase } from '../../domain/demoPlaylist';
import { ItemVisualContent } from './PhysicalPlaybackItem';
import { recordDropResult, PHYSICS_DT } from './SorterPhysics';
import { getModelAsset } from '../../data/modelAssets';
import { isProductAssetReady } from './RealItemModel';

type Authority = 'preparing' | 'dynamic_active' | 'frozen' | 'fault_kinematic';

const TELEMETRY_INTERVAL_MS = 200;
const SETTLE_BUDGET_SEC = 10;

function colliderDensity(profile: ReturnType<typeof getProductPhysicsProfile>): number {
  const c = profile.collider;
  if (c.type === 'cuboid') {
    const [hx, hy, hz] = c.halfExtents;
    return profile.massKg / (8 * hx * hy * hz);
  }
  const volume = c.type === 'capsule'
    ? Math.PI * c.radius * c.radius * (2 * c.halfHeight + (4 / 3) * c.radius)
    : Math.PI * c.radius * c.radius * 2 * c.halfHeight;
  return profile.massKg / Math.max(volume, 1e-6);
}

function PhysicalPlaybackItemPhysicsInner({
  caseData,
  elapsedMs,
  slotIndex = 0,
  jitter,
  castShadow = false,
  verifySku = null,
}: {
  caseData: PlaylistCase;
  elapsedMs: number;
  slotIndex?: number;
  jitter?: { x: number; z: number; yaw: number };
  castShadow?: boolean;
  verifySku?: string | null;
}) {
  const itemData = useMemo(() => resolveItem(caseData.itemId), [caseData.itemId]);
  const classification = useMemo(() => classifyItem(itemData), [itemData]);
  const category = classification.category as 'B' | 'C' | 'D';
  const itemId = itemData.id.replace('-LC', '');
  const profile = getProductPhysicsProfile(itemId);
  const halfH = colliderHalfHeight(profile);
  const isFault = Boolean(caseData.faultType);

  const bodyRef = useRef<RapierRigidBody>(null);
  const authority = useRef<Authority>(isFault ? 'fault_kinematic' : 'preparing');
  const phaseRef = useRef<ProductPhysicsPhase>('preparing');
  const frozenPose = useRef<{ p: [number, number, number]; q: THREE.Quaternion } | null>(null);
  const verified = useRef(false);
  const activated = useRef(false);
  const invalidLogged = useRef(false);
  const lastTelemetryMs = useRef(0);
  const forceScratch = useRef({ x: 0, y: 0, z: 0 });
  const settleAccum = useRef(0);
  const activeSinceSec = useRef(0);
  const bodyIdentity = useRef(`${caseData.id}:${itemId}`);

  const asset = getModelAsset(itemId);
  const needsRealAsset = Boolean(asset?.defaultRealAsset && asset?.runtimePath);
  const [spawned, setSpawned] = useState(
    () => !needsRealAsset || isProductAssetReady(asset?.runtimePath),
  );
  const onVisualReady = useCallback(() => {
    setSpawned(true);
  }, []);

  const pose = getPhysicalItemPose({
    caseId: caseData.id,
    slotIndex,
    dimensionsMm: itemData.dimensionsMm,
    targetCategory: classification.category,
    elapsedMs,
    faultType: caseData.faultType,
    jitter,
  });

  const spawnPose = useMemo(() => {
    const p = getPhysicalItemPose({
      caseId: caseData.id,
      slotIndex,
      dimensionsMm: itemData.dimensionsMm,
      targetCategory: classification.category,
      elapsedMs: 0,
      faultType: caseData.faultType,
      jitter,
    });
    return {
      position: [p.position[0], spawnCenterY(profile), p.position[2]] as [number, number, number],
      rotation: p.rotation,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.id, profile.productId]);

  useLayoutEffect(() => {
    bodyIdentity.current = `${caseData.id}:${itemId}`;
    authority.current = isFault ? 'fault_kinematic' : 'preparing';
    phaseRef.current = 'preparing';
    frozenPose.current = null;
    verified.current = false;
    activated.current = false;
    invalidLogged.current = false;
    settleAccum.current = 0;
    activeSinceSec.current = 0;
    const ready = !needsRealAsset || isProductAssetReady(asset?.runtimePath);
    setSpawned(ready);
    const body = bodyRef.current;
    if (body) {
      // Imperative spawn pose — never reapplied via React RigidBody props.
      body.setBodyType(RigidBodyType.KinematicPositionBased, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const p = spawnPose.position;
      body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
      const e = new THREE.Euler(spawnPose.rotation[0], spawnPose.rotation[1], spawnPose.rotation[2]);
      const q = new THREE.Quaternion().setFromEuler(e);
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    }
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const w = window as unknown as { __ACTIVE_PRODUCT_BODIES?: Set<string> };
      w.__ACTIVE_PRODUCT_BODIES = w.__ACTIVE_PRODUCT_BODIES ?? new Set();
      w.__ACTIVE_PRODUCT_BODIES.add(bodyIdentity.current);
    }
    return () => {
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        const w = window as unknown as { __ACTIVE_PRODUCT_BODIES?: Set<string> };
        w.__ACTIVE_PRODUCT_BODIES?.delete(bodyIdentity.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.id]);

  const activateDynamic = useCallback((body: RapierRigidBody) => {
    const p = spawnPose.position;
    body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
    const e = new THREE.Euler(spawnPose.rotation[0], spawnPose.rotation[1], spawnPose.rotation[2]);
    const q = new THREE.Quaternion().setFromEuler(e);
    body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setBodyType(RigidBodyType.Dynamic, true);
    body.wakeUp();
    activated.current = true;
    authority.current = 'dynamic_active';
    phaseRef.current = 'physical_conveyor';
    activeSinceSec.current = 0;
  }, [spawnPose]);

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    if (!body || !spawned) return;
    if (authority.current !== 'dynamic_active') {
      body.resetForces(true);
      return;
    }
    const dt = PHYSICS_DT;
    activeSinceSec.current += dt;

    const t = body.translation();
    const lv = body.linvel();
    const av = body.angvel();
    const position: [number, number, number] = [t.x, t.y, t.z];
    const linearVelocity: [number, number, number] = [lv.x, lv.y, lv.z];
    const angularVelocity: [number, number, number] = [av.x, av.y, av.z];

    if (isInvalidProductState({ position, linearVelocity, angularVelocity })) {
      if (!invalidLogged.current) {
        recordInvalidProductState();
        invalidLogged.current = true;
        if (import.meta.env.DEV) {
          console.warn('[physics] invalid product state', itemId, position);
        }
      }
      body.resetForces(true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setBodyType(RigidBodyType.KinematicPositionBased, false);
      authority.current = 'frozen';
      phaseRef.current = 'invalid';
      return;
    }

    if (t.x >= DOCUMENTED_CONTACT_PLANE_S) {
      phaseRef.current = 'junction';
    }

    const supported = isSupportedByBelt({
      position,
      halfHeight: halfH,
      phase: phaseRef.current === 'junction' ? 'junction' : 'physical_conveyor',
      linearVelY: lv.y,
    });

    body.resetForces(true);
    if (supported) {
      const sample = computeBeltDriveForce({
        massKg: profile.massKg,
        linearVelocity,
        maxBeltAccelerationMps2: profile.maxBeltAccelerationMps2,
        // Zero lateral correction inside physical junction / contact zone.
        applyLateralCorrection: t.x < DOCUMENTED_CONTACT_PLANE_S,
      });
      // Stationary belt collider cannot impart tangential speed — couple after
      // measuring the drive sample. Upstream: hard 1.0 m/s. Junction: gentle
      // pull so contact can redirect C/D without wiping lateral velocity.
      const inJunction = t.x >= DOCUMENTED_CONTACT_PLANE_S;
      const latV = sample.lateralCorrection[2] * dt / Math.max(profile.massKg, 1e-6);
      forceScratch.current.x = inJunction
        ? lv.x + Math.max(-8, Math.min(8, (BELT_SPEED_MPS - lv.x) * 0.35))
        : BELT_SPEED_MPS;
      forceScratch.current.y = Math.min(lv.y, 0.05);
      forceScratch.current.z = inJunction ? lv.z : lv.z + latV;
      body.setLinvel(forceScratch.current, true);

      if (import.meta.env.DEV && typeof window !== 'undefined') {
        const now = performance.now();
        if (now - lastTelemetryMs.current >= TELEMETRY_INTERVAL_MS) {
          lastTelemetryMs.current = now;
          window.__CONVEYOR_PHYSICS_DEBUG__ = {
            productId: itemId,
            route: category,
            physicsPhase: phaseRef.current,
            supportedByBelt: supported,
            currentDownstreamSpeed: sample.currentDownstreamSpeed,
            targetSpeed: BELT_SPEED_MPS,
            appliedAcceleration: sample.appliedAcceleration,
            bodyPosition: position,
            bodyIdentity: bodyIdentity.current,
            invalidState: false,
          };
        }
      }
    }

    // Receiver sensor detection — never moves the body.
    const zone = detectReceiverZone(position);
    if (zone) {
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      const ang = Math.hypot(av.x, av.y, av.z);
      if (speed <= SETTLE_LINEAR_SPEED_MPS && ang <= SETTLE_ANGULAR_SPEED_RAD_S) {
        settleAccum.current += dt;
      } else {
        settleAccum.current = Math.max(0, settleAccum.current - dt * 0.25);
      }
      if (!verified.current
        && (settleAccum.current >= SETTLE_DURATION_SEC
          || (activeSinceSec.current > SETTLE_BUDGET_SEC && speed < 0.35))) {
        verified.current = true;
        recordDropResult({
          caseId: caseData.id,
          itemId,
          expectedZone: category,
          finalPosition: position,
          insideExpectedReceiver: receiverContains(category, position),
          settledByTimeout: settleAccum.current < SETTLE_DURATION_SEC,
          timestampMs: Date.now(),
        });
        const r = body.rotation();
        frozenPose.current = {
          p: position,
          q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
        };
        body.resetForces(true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        body.setBodyType(RigidBodyType.KinematicPositionBased, false);
        authority.current = 'frozen';
        phaseRef.current = 'settled';
      }
    }
  });

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;

    if (!spawned) {
      const p = spawnPose.position;
      body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
      const e = new THREE.Euler(spawnPose.rotation[0], spawnPose.rotation[1], spawnPose.rotation[2]);
      const q = new THREE.Quaternion().setFromEuler(e);
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    if (authority.current === 'preparing' && !activated.current && !isFault) {
      activateDynamic(body);
      return;
    }

    if (authority.current === 'fault_kinematic') {
      const p = pose.position;
      const e = new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
      const q = new THREE.Quaternion().setFromEuler(e);
      body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      return;
    }

    if (authority.current === 'frozen' && frozenPose.current) {
      const { p, q } = frozenPose.current;
      body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
  });

  if (elapsedMs < 0) return null;

  const density = colliderDensity(profile);
  const enabledRotations = useMemo<[boolean, boolean, boolean]>(
    () => [!profile.lockRotationX, !profile.lockRotationY, !profile.lockRotationZ],
    [profile.lockRotationX, profile.lockRotationY, profile.lockRotationZ],
  );

  // Initial pose props are mount-only (component is memoized against elapsedMs
  // for non-fault cases). Never pass `type` — imperative setBodyType owns it.
  // World transform authority after spawn: Rapier body → R3F object3D sync.
  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      friction={profile.beltFriction}
      restitution={profile.restitution}
      linearDamping={profile.linearDamping}
      angularDamping={profile.angularDamping}
      ccd={profile.ccd}
      canSleep={false}
      gravityScale={1}
      enabledRotations={enabledRotations}
      position={spawnPose.position}
      rotation={spawnPose.rotation}
      name={`product-body-${itemId}`}
      userData={{ productId: itemId, bodyIdentity: bodyIdentity.current }}
    >
      {spawned && profile.collider.type === 'cuboid' && (
        <CuboidCollider
          args={profile.collider.halfExtents}
          density={density}
          friction={profile.guideFriction}
          restitution={profile.restitution}
        />
      )}
      {spawned && profile.collider.type === 'capsule' && (
        <CapsuleCollider
          args={[profile.collider.halfHeight, profile.collider.radius]}
          density={density}
          friction={profile.guideFriction}
          restitution={profile.restitution}
          rotation={profile.collider.axis === 'x' ? [0, 0, Math.PI / 2] : undefined}
        />
      )}
      {spawned && profile.collider.type === 'cylinder' && (
        <CylinderCollider
          args={[profile.collider.halfHeight, profile.collider.radius]}
          density={density}
          friction={profile.guideFriction}
          restitution={profile.restitution}
          rotation={profile.collider.axis === 'x' ? [0, 0, Math.PI / 2] : undefined}
        />
      )}
      <group name="ProductVisualGroup" visible={spawned}>
        <ItemVisualContent
          caseData={caseData}
          phase={pose.phase}
          surface={pose.surface}
          isSettled={authority.current === 'frozen'}
          castShadow={castShadow && spawned}
          verifySku={verifySku}
          onVisualReady={onVisualReady}
        />
      </group>
    </RigidBody>
  );
}

/**
 * Block playback-tick re-renders for normal (non-fault) products so React
 * RigidBody props cannot fight Rapier's mesh sync every frame.
 */
export const PhysicalPlaybackItemPhysics = memo(
  PhysicalPlaybackItemPhysicsInner,
  (prev, next) => {
    if (prev.caseData.id !== next.caseData.id) return false;
    if (prev.slotIndex !== next.slotIndex) return false;
    if (prev.castShadow !== next.castShadow) return false;
    if (prev.verifySku !== next.verifySku) return false;
    if (prev.caseData.faultType !== next.caseData.faultType) return false;
    if (prev.jitter !== next.jitter) return false;
    // Fault kinematics still need elapsedMs; physical products do not.
    if (next.caseData.faultType) {
      return prev.elapsedMs === next.elapsedMs;
    }
    return true;
  },
);
