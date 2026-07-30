/**
 * Stage 2 — item with hybrid kinematic/dynamic authority (Rapier).
 *
 * Authority flow (see docs/stage2_real_sorter/physics-architecture.md):
 *  1. kinematicPosition — follows getPhysicalItemPose exactly (domain truth);
 *  2. at getDropHandoffTimeMs → dynamic with deterministic initial velocity
 *     (B: belt edge carry-over; C/D: pusher impulse, scaled per SKU profile);
 *  3. gravity/collision/friction/restitution/angular velocity govern the drop;
 *  4. on sleep (or controlled 4.5 s timeout) the final position is verified
 *     against the DOMAIN-decided receiver volume and the body is frozen
 *     (kinematic) — no drift, clean replay, no teleportation at any point.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  RigidBody,
  CuboidCollider,
  CapsuleCollider,
  CylinderCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { RigidBodyType } from '@dimforge/rapier3d-compat';
import { getPhysicalItemPose, getDropHandoffTimeMs } from '../../domain/physicalItemMotion';
import { getVisualPhysicsProfile } from '../../domain/visualPhysicsProfiles';
import { resolveItem } from '../../data/resolveItem';
import { classifyItem } from '../../domain/classifier';
import { receiverContains } from '../../domain/receiverVolumes';
import type { PlaylistCase } from '../../domain/demoPlaylist';
import { ItemVisualContent } from './PhysicalPlaybackItem';
import { recordDropResult, physicsSimClock } from './SorterPhysics';

type Authority = 'kinematic' | 'dynamic' | 'frozen';

/** Controlled settle budget after handoff — in PHYSICS-simulated seconds,
 *  not domain ms: under render lag domain time races ahead of the stepper,
 *  and a domain-ms budget would freeze items mid-flight (§14.2). */
const SETTLE_BUDGET_SEC = 4.5;

function colliderDensity(profile: ReturnType<typeof getVisualPhysicsProfile>): number {
  if (profile.collider === 'cuboid' && profile.cuboidHalfExtents) {
    const [hx, hy, hz] = profile.cuboidHalfExtents;
    return profile.approximateMassKg / (8 * hx * hy * hz);
  }
  const [r, hh] = profile.capsule ?? [0.05, 0.1];
  const volume = profile.collider === 'capsule'
    ? Math.PI * r * r * (2 * hh + (4 / 3) * r)
    : Math.PI * r * r * 2 * hh;
  return profile.approximateMassKg / volume;
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
  const profile = getVisualPhysicsProfile(itemId);
  const handoffMs = getDropHandoffTimeMs(classification.category, caseData.faultType);

  const bodyRef = useRef<RapierRigidBody>(null);
  const traceEnabled = useRef(
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('trace') === '1',
  );
  const authority = useRef<Authority>('kinematic');
  const frozenPose = useRef<{ p: [number, number, number]; q: THREE.Quaternion } | null>(null);
  const handedOffAtSimSec = useRef<number | null>(null);
  const verified = useRef(false);

  const pose = getPhysicalItemPose({
    caseId: caseData.id,
    slotIndex,
    dimensionsMm: itemData.dimensionsMm,
    targetCategory: classification.category,
    elapsedMs,
    faultType: caseData.faultType,
    jitter,
  });

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

  // Reset authority whenever a new case mounts this body. The Rapier body is
  // reused across cases, so a case that ended while still DYNAMIC (settle
  // budget cut short under render lag) must be forced back to kinematic —
  // otherwise setNextKinematicTranslation is a no-op and the next case's item
  // is stuck invisibly mid-scene.
  useEffect(() => {
    authority.current = 'kinematic';
    frozenPose.current = null;
    handedOffAtSimSec.current = null;
    verified.current = false;
    const body = bodyRef.current;
    if (body) {
      body.setBodyType(RigidBodyType.KinematicPositionBased, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    }
  }, [caseData.id]);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;

    if (authority.current === 'kinematic') {
      // Physics handoff at pusher contact / belt edge — never for fault cases.
      // MUST be checked BEFORE the kinematic drive: under render lag a single
      // frame can jump several seconds past handoffMs, and pose(elapsedMs) is
      // then already deep inside the receiver. Applying setNextKinematic*
      // from that pose in the same frame as the dynamic switch teleports the
      // body (forbidden) — the next-step kinematic target still applies.
      if (handoffMs != null && handoffPose && elapsedMs >= handoffMs) {
        const hp = handoffPose.position;
        body.setTranslation({ x: hp[0], y: hp[1], z: hp[2] }, true);
        const he = new THREE.Euler(handoffPose.rotation[0], handoffPose.rotation[1], handoffPose.rotation[2]);
        const hq = new THREE.Quaternion().setFromEuler(he);
        body.setRotation({ x: hq.x, y: hq.y, z: hq.z, w: hq.w }, true);
        body.setBodyType(RigidBodyType.Dynamic, true);
        // Deterministic initial velocity: belt carry-over only — for C/D the
        // Z motion comes from the kinematic paddle CONTACT (Stage 2B §13).
        body.setLinvel({ x: 1.0, y: 0, z: 0 }, true);
        if (profile.canRoll && category === 'B') {
          body.setAngvel({ x: 2.0, y: 0.4, z: 0 }, true);
        } else {
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        authority.current = 'dynamic';
        handedOffAtSimSec.current = physicsSimClock.simSec;
        return;
      }

      // Kinematic drive: domain pose is truth (belt travel, inspection dwell).
      const p = pose.position;
      const e = new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
      const q = new THREE.Quaternion().setFromEuler(e);
      body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      return;
    }

    if (authority.current === 'dynamic') {
      const slept = body.isSleeping();
      const lv = body.linvel();
      const av = body.angvel();
      const slow = Math.hypot(lv.x, lv.y, lv.z) < 0.2 && Math.hypot(av.x, av.y, av.z) < 1.0;
      if (traceEnabled.current) {
        const t = body.translation();
        const w = window as unknown as { __ITEM_TRACE?: unknown[] };
        w.__ITEM_TRACE = w.__ITEM_TRACE ?? [];
        const arr = w.__ITEM_TRACE as { e: number; x: number; y: number; z: number; lv: number; slept: boolean }[];
        if (arr.length === 0 || arr[arr.length - 1].e < elapsedMs - 200) {
          arr.push({ e: Math.round(elapsedMs), x: +t.x.toFixed(3), y: +t.y.toFixed(3), z: +t.z.toFixed(3), lv: +Math.hypot(lv.x, lv.y, lv.z).toFixed(2), slept });
          if (arr.length > 120) arr.shift();
        }
      }
      const timedOut = handedOffAtSimSec.current != null
        && physicsSimClock.simSec - handedOffAtSimSec.current > SETTLE_BUDGET_SEC;
      // §14.2: freeze only after actual rest (sleep) or a timeout WITH low
      // velocities — never freeze a body that is still moving/flying.
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
      }
      return;
    }

    // frozen: hold the verified rest pose (no drift across replays).
    if (frozenPose.current) {
      const { p, q } = frozenPose.current;
      body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
  });

  if (elapsedMs < 0) return null;

  const density = colliderDensity(profile);
  // CCD for small/fast items (pen) and thin items (plate) — mirrors the sim.
  const ccd = profile.approximateMassKg < 0.05 || itemData.dimensionsMm.height < 50;

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      friction={profile.friction}
      restitution={profile.restitution}
      linearDamping={profile.linearDamping}
      angularDamping={profile.angularDamping}
      ccd={ccd}
      enabledRotations={[true, true, true]}
      position={pose.position}
    >
      {profile.collider === 'cuboid' && profile.cuboidHalfExtents && (
        <CuboidCollider args={profile.cuboidHalfExtents} density={density} />
      )}
      {profile.collider === 'capsule' && profile.capsule && (
        <CapsuleCollider
          args={[profile.capsule[1], profile.capsule[0]]}
          density={density}
          rotation={profile.colliderAxis === 'x' ? [0, 0, Math.PI / 2] : undefined}
        />
      )}
      {profile.collider === 'cylinder' && profile.capsule && (
        <CylinderCollider
          args={[profile.capsule[1], profile.capsule[0]]}
          density={density}
          rotation={profile.colliderAxis === 'x' ? [0, 0, Math.PI / 2] : undefined}
        />
      )}
      <ItemVisualContent
        caseData={caseData}
        phase={pose.phase}
        surface={pose.surface}
        isSettled={authority.current === 'frozen' ? true : pose.isSettled}
        castShadow={castShadow}
        verifySku={verifySku}
      />
    </RigidBody>
  );
});
