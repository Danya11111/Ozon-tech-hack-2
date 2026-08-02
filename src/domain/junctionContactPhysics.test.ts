import { beforeAll, describe, expect, it } from 'vitest';
import {
  DOCUMENTED_CONTACT_PLANE_S,
  DOCUMENTED_CLEAR_PLANE_S,
  DIVERTER_COLLIDER_HALF_EXTENTS,
  DIVERTER_WORLD_PIVOTS,
  diverterColliderPose,
  hingeDriftMm,
  angleDifferenceDeg,
  neutralCorridorWidthM,
  simulateJunctionContact,
  runJunctionMatrix,
} from './junctionContactPhysics';
import { initRapier } from './physicsDropSim';
import {
  DIVERTER_LEFT_SIGNED_DEG,
  DIVERTER_RIGHT_SIGNED_DEG,
  categoryToPhysicalRoute,
  OPENING_SAFETY_MARGIN_SEC,
  rotationDurationSec,
  GATE_VANE,
} from './pusherMotion';
import { BELT_SPEED_MPS, getProductPhysicsProfile } from './productPhysicsProfiles';
import { PHYSICS_TIMESTEP_SEC } from './physicsTimestep';
import PhysicalPlaybackItemPhysicsSrc from '../components/ThreeD/PhysicalPlaybackItemPhysics.tsx?raw';

beforeAll(async () => {
  await initRapier();
});

describe('diverter collider / CAD geometry contracts', () => {
  it('uses canonical half-extents [0.375, 0.05, 0.02]', () => {
    expect(DIVERTER_COLLIDER_HALF_EXTENTS).toEqual([0.375, 0.05, 0.02]);
    expect(GATE_VANE.halfExtents).toEqual([0.375, 0.05, 0.02]);
  });

  it('LEFT/RIGHT collider angles match CAD pivot yaw at neutral and active', () => {
    const left0 = diverterColliderPose(DIVERTER_WORLD_PIVOTS.left, 0);
    const right0 = diverterColliderPose(DIVERTER_WORLD_PIVOTS.right, 0);
    expect(angleDifferenceDeg(left0.yawRad, 0)).toBeLessThanOrEqual(0.5);
    expect(angleDifferenceDeg(right0.yawRad, 0)).toBeLessThanOrEqual(0.5);

    const leftOpen = (DIVERTER_LEFT_SIGNED_DEG * Math.PI) / 180;
    const rightOpen = (DIVERTER_RIGHT_SIGNED_DEG * Math.PI) / 180;
    const leftA = diverterColliderPose(DIVERTER_WORLD_PIVOTS.left, leftOpen);
    const rightA = diverterColliderPose(DIVERTER_WORLD_PIVOTS.right, rightOpen);
    expect(angleDifferenceDeg(leftA.yawRad, leftOpen)).toBeLessThanOrEqual(0.5);
    expect(angleDifferenceDeg(rightA.yawRad, rightOpen)).toBeLessThanOrEqual(0.5);
  });

  it('hinge drift and center offset stay within calibration budgets', () => {
    const pivot = DIVERTER_WORLD_PIVOTS.left;
    const pose = diverterColliderPose(pivot, 0);
    expect(hingeDriftMm(pose.pivot, pivot)).toBeLessThanOrEqual(0.5);
    // Center is half-length upstream of hinge along −X.
    const expectedCenter = {
      x: pivot.x - DIVERTER_COLLIDER_HALF_EXTENTS[0],
      y: pivot.y,
      z: pivot.z,
    };
    const offsetMm = Math.hypot(
      pose.center.x - expectedCenter.x,
      pose.center.y - expectedCenter.y,
      pose.center.z - expectedCenter.z,
    ) * 1000;
    expect(offsetMm).toBeLessThanOrEqual(2);
  });

  it('neutral corridor remains open for widest B product', () => {
    const width = neutralCorridorWidthM();
    const widestB = getProductPhysicsProfile('SKU-001');
    const halfW = widestB.collider.type === 'cuboid'
      ? Math.max(widestB.collider.halfExtents[0], widestB.collider.halfExtents[2])
      : 0.15;
    expect(width).toBeGreaterThan(halfW * 2 + 0.04);
  });

  it('B/C/D diverter selection mapping', () => {
    expect(categoryToPhysicalRoute('B')).toBe('STRAIGHT');
    expect(categoryToPhysicalRoute('C')).toBe('PHYSICAL_LEFT');
    expect(categoryToPhysicalRoute('D')).toBe('PHYSICAL_RIGHT');
  });

  it('frozen timing and planes unchanged', () => {
    expect(rotationDurationSec()).toBeCloseTo(0.5, 6);
    expect(OPENING_SAFETY_MARGIN_SEC).toBeCloseTo(0.15, 6);
    expect(DOCUMENTED_CONTACT_PLANE_S).toBe(1.0538);
    expect(DOCUMENTED_CLEAR_PLANE_S).toBe(1.6);
    expect(BELT_SPEED_MPS).toBe(1.0);
    expect(PHYSICS_TIMESTEP_SEC).toBeCloseTo(1 / 120, 12);
  });

  it('runtime product code has no route-specific translation / handoff', () => {
    expect(PhysicalPlaybackItemPhysicsSrc).not.toMatch(/getDropHandoffTimeMs/);
    expect(PhysicalPlaybackItemPhysicsSrc).not.toMatch(/handoffPose/);
    expect(PhysicalPlaybackItemPhysicsSrc).toMatch(/dynamic_active/);
    expect(PhysicalPlaybackItemPhysicsSrc).toMatch(/detectReceiverZone/);
    expect(PhysicalPlaybackItemPhysicsSrc).toMatch(/ccd=\{profile\.ccd\}/);
  });

  it('CCD remains enabled on profiles', () => {
    for (const id of ['SKU-001', 'SKU-004', 'SKU-007', 'SKU-009']) {
      expect(getProductPhysicsProfile(id).ccd).toBe(true);
    }
  });
});

describe('deterministic physical junction matrix', () => {
  it('single B/C/D smoke runs enter correct receivers', () => {
    const b = simulateJunctionContact('SKU-001', 'B');
    const c = simulateJunctionContact('SKU-005', 'C');
    const d = simulateJunctionContact('SKU-006', 'D');
    expect(b.failure, JSON.stringify(b)).toBeNull();
    expect(c.failure, JSON.stringify(c)).toBeNull();
    expect(d.failure, JSON.stringify(d)).toBeNull();
    expect(b.correctReceiver).toBe(true);
    expect(c.correctReceiver).toBe(true);
    expect(d.correctReceiver).toBe(true);
    expect(c.contactCount).toBeGreaterThan(0);
    expect(d.contactCount).toBeGreaterThan(0);
    expect(b.contactWhileOpening + c.contactWhileOpening + d.contactWhileOpening).toBe(0);
  });

  it('45/45 matrix: correct receivers, no tunnelling/invalid/duplicate failures', () => {
    const matrix = runJunctionMatrix(5);
    expect(matrix.total).toBe(45);
    const failures = matrix.results.filter((r) => !r.correctReceiver || r.failure);
    expect(failures, JSON.stringify(failures.slice(0, 5), null, 2)).toHaveLength(0);
    expect(matrix.passed).toBe(45);
    expect(matrix.results.every((r) => !r.tunnelling)).toBe(true);
    expect(matrix.results.every((r) => !r.invalidState)).toBe(true);
    expect(matrix.results.every((r) => r.contactWhileOpening === 0)).toBe(true);
  });
});
