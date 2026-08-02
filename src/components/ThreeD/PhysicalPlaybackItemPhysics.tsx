/**
 * Product rigid body: dynamic physical conveyor foundation + junction handoff.
 *
 * Lifecycle:
 *  PREPARING → PHYSICAL_CONVEYOR (dynamic + belt force) → JUNCTION
 *  (existing drop/settle authority at getDropHandoffTimeMs) → FROZEN.
 *
 * Temporary handoff: belt drive stops at JUNCTION_ENTRY_S / handoffMs; current
 * classifier+diverter routing remains responsible for basket assignment.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getPhysicalItemPose, getDropHandoffTimeMs } from '../../domain/physicalItemMotion';
import {
  getProductPhysicsProfile,
  colliderHalfHeight,
  spawnCenterY,
  isSupportedByBelt,
  computeBeltDriveForce,
  isInvalidProductState,
  recordInvalidProductState,
  JUNCTION_ENTRY_S,
  BELT_SPEED_MPS,
  type ProductPhysicsPhase,
} from '../../domain/productPhysicsProfiles';
import { resolveItem } from '../../data/resolveItem';
import { classifyItem } from '../../domain/classifier';
import { receiverContains } from '../../domain/receiverVolumes';
import type { PlaylistCase } from '../../domain/demoPlaylist';
import { ItemVisualContent } from './PhysicalPlaybackItem';
import { recordDropResult, physicsSimClock } from './SorterPhysics';
import { getModelAsset } from '../../data/modelAssets';
import { isProductAssetReady } from './RealItemModel';

type Authority = 'preparing' | 'physical_conveyor' | 'junction' | 'frozen' | 'fault_kinematic';

const SETTLE_BUDGET_SEC = 4.5;
const TELEMETRY_INTERVAL_MS = 200;

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

export const PhysicalPlaybackItemPhysics = memo(function PhysicalPlaybackItemPhysics({
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
  const handoffMs = getDropHandoffTimeMs(classification.category, caseData.faultType);
  const isFault = Boolean(caseData.faultType);

  const bodyRef = useRef<RapierRigidBody>(null);
  const authority = useRef<Authority>(isFault ? 'fault_kinematic' : 'preparing');
  const phaseRef = useRef<ProductPhysicsPhase>('preparing');
  const frozenPose = useRef<{ p: [number, number, number]; q: THREE.Quaternion } | null>(null);
  const handedOffAtSimSec = useRef<number | null>(null);
  const verified = useRef(false);
  const activated = useRef(false);
  const invalidLogged = useRef(false);
  const lastTelemetryMs = useRef(0);
  const forceScratch = useRef({ x: 0, y: 0, z: 0 });
  const elapsedMsRef = useRef(elapsedMs);
  elapsedMsRef.current = elapsedMs;

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
    const y = spawnCenterY(profile);
    return {
      position: [p.position[0], y, p.position[2]] as [number, number, number],
      rotation: p.rotation,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.id, profile.productId]);

  const handoffPose = useMemo(() => {
    if (handoffMs == null) return null;
    return getPhysicalItemPose({
      caseId: caseData.id,
      slotIndex,
      dimensionsMm: itemData.dimensionsMm,
      targetCategory: classification.category,
      elapsedMs: handoffMs,
      faultType: caseData.faultType,
      jitter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffMs, caseData.id]);

  useEffect(() => {
    authority.current = isFault ? 'fault_kinematic' : 'preparing';
    phaseRef.current = 'preparing';
    frozenPose.current = null;
    handedOffAtSimSec.current = null;
    verified.current = false;
    activated.current = false;
    invalidLogged.current = false;
    const ready = !needsRealAsset || isProductAssetReady(asset?.runtimePath);
    setSpawned(ready);
    const body = bodyRef.current;
    if (body) {
      body.setBodyType(RigidBodyType.KinematicPositionBased, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const p = spawnPose.position;
      body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
      const e = new THREE.Euler(spawnPose.rotation[0], spawnPose.rotation[1], spawnPose.rotation[2]);
      const q = new THREE.Quaternion().setFromEuler(e);
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    }
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
    authority.current = 'physical_conveyor';
    phaseRef.current = 'physical_conveyor';
  }, [spawnPose]);

  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    if (!body || !spawned) return;
    if (authority.current !== 'physical_conveyor') {
      body.resetForces(true);
      return;
    }

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

    // Temporary junction handoff: stop belt drive; keep dynamic body for drop.
    if ((handoffMs != null && elapsedMsRef.current >= handoffMs) || t.x >= JUNCTION_ENTRY_S) {
      body.resetForces(true);
      if (authority.current === 'physical_conveyor') {
        if (handoffPose) {
          // Align only once at handoff — no per-frame kinematic competition.
          const hp = body.translation();
          // Prefer live physical X/Z; keep Y from body (no teleport).
          void hp;
        }
        body.setLinvel({ x: Math.max(lv.x, BELT_SPEED_MPS * 0.85), y: lv.y, z: lv.z }, true);
        authority.current = 'junction';
        phaseRef.current = 'junction';
        handedOffAtSimSec.current = physicsSimClock.simSec;
      }
      return;
    }

    const supported = isSupportedByBelt({
      position,
      halfHeight: halfH,
      phase: 'physical_conveyor',
      linearVelY: lv.y,
    });

    body.resetForces(true);
    if (!supported) return;

    const sample = computeBeltDriveForce({
      massKg: profile.massKg,
      linearVelocity,
      maxBeltAccelerationMps2: profile.maxBeltAccelerationMps2,
      applyLateralCorrection: t.x < JUNCTION_ENTRY_S,
    });

    forceScratch.current.x = sample.force[0] + sample.lateralCorrection[0];
    forceScratch.current.y = sample.force[1] + sample.lateralCorrection[1];
    forceScratch.current.z = sample.force[2] + sample.lateralCorrection[2];
    body.addForce(forceScratch.current, true);

    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const now = performance.now();
      if (now - lastTelemetryMs.current >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryMs.current = now;
        window.__CONVEYOR_PHYSICS_DEBUG__ = {
          productId: itemId,
          profileId: profile.productId,
          physicsPhase: phaseRef.current,
          supportedByBelt: supported,
          currentDownstreamSpeed: sample.currentDownstreamSpeed,
          targetSpeed: BELT_SPEED_MPS,
          appliedAcceleration: sample.appliedAcceleration,
          appliedForceMagnitude: Math.hypot(
            forceScratch.current.x,
            forceScratch.current.y,
            forceScratch.current.z,
          ),
          lateralSpeed: lv.z,
          angularSpeed: Math.hypot(av.x, av.y, av.z),
          bodyPosition: position,
          invalidState: false,
        };
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

    if (authority.current === 'junction') {
      const slept = body.isSleeping();
      const lv = body.linvel();
      const av = body.angvel();
      const slow = Math.hypot(lv.x, lv.y, lv.z) < 0.2 && Math.hypot(av.x, av.y, av.z) < 1.0;
      const timedOut = handedOffAtSimSec.current != null
        && physicsSimClock.simSec - handedOffAtSimSec.current > SETTLE_BUDGET_SEC;
      if ((slept || (timedOut && slow)) && !verified.current) {
        verified.current = true;
        const t = body.translation();
        const p: [number, number, number] = [t.x, t.y, t.z];
        recordDropResult({
          caseId: caseData.id,
          itemId,
          expectedZone: category,
          finalPosition: p,
          insideExpectedReceiver: receiverContains(category, p),
          settledByTimeout: !slept,
          timestampMs: Date.now(),
        });
        const r = body.rotation();
        frozenPose.current = { p, q: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
        body.setBodyType(RigidBodyType.KinematicPositionBased, false);
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        authority.current = 'frozen';
        phaseRef.current = 'settled';
      }
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
  const enabledRotations: [boolean, boolean, boolean] = [
    !profile.lockRotationX,
    !profile.lockRotationY,
    !profile.lockRotationZ,
  ];

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
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
    >
      {spawned && profile.collider.type === 'cuboid' && (
        <CuboidCollider args={profile.collider.halfExtents} density={density} friction={profile.beltFriction} />
      )}
      {spawned && profile.collider.type === 'capsule' && (
        <CapsuleCollider
          args={[profile.collider.halfHeight, profile.collider.radius]}
          density={density}
          friction={profile.beltFriction}
          rotation={profile.collider.axis === 'x' ? [0, 0, Math.PI / 2] : undefined}
        />
      )}
      {spawned && profile.collider.type === 'cylinder' && (
        <CylinderCollider
          args={[profile.collider.halfHeight, profile.collider.radius]}
          density={density}
          friction={profile.beltFriction}
          rotation={profile.collider.axis === 'x' ? [0, 0, Math.PI / 2] : undefined}
        />
      )}
      <group visible={spawned}>
        <ItemVisualContent
          caseData={caseData}
          phase={pose.phase}
          surface={pose.surface}
          isSettled={authority.current === 'frozen' ? true : pose.isSettled}
          castShadow={castShadow && spawned}
          verifySku={verifySku}
          onVisualReady={onVisualReady}
        />
      </group>
    </RigidBody>
  );
});
