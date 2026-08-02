import { describe, expect, it, beforeEach } from 'vitest';
import {
  BELT_SPEED_MPS,
  BELT_RESPONSE_TIME_SEC,
  BELT_SPEED_EPSILON,
  DOWNSTREAM_AXIS,
  LATERAL_AXIS,
  UP_AXIS,
  JUNCTION_ENTRY_S,
  getProductPhysicsProfile,
  computeBeltDriveForce,
  isSupportedByBelt,
  spawnCenterY,
  colliderHalfHeight,
  resetInvalidProductStateCount,
  INVALID_PRODUCT_STATE_COUNT,
  isInvalidProductState,
} from './productPhysicsProfiles';
import {
  PHYSICS_TIMESTEP_SEC,
  PHYSICS_MAX_SUBSTEPS,
  MAX_FRAME_DELTA_SEC,
} from './physicsTimestep';
import { BELT_TOP_Y, CONVEYOR_SPEED_MPS } from './physicalLayout';
import {
  categoryToPhysicalRoute,
  DIVERTER_LEFT_SIGNED_DEG,
  DIVERTER_RIGHT_SIGNED_DEG,
  OPENING_SAFETY_MARGIN_SEC,
  rotationDurationSec,
} from './pusherMotion';

describe('physical conveyor foundation contracts', () => {
  beforeEach(() => {
    resetInvalidProductStateCount();
  });

  it('BELT_SPEED_MPS equals exactly 1.0', () => {
    expect(BELT_SPEED_MPS).toBe(1.0);
    expect(CONVEYOR_SPEED_MPS).toBe(1.0);
  });

  it('fixed timestep equals 1/120 and max substeps equals 4', () => {
    expect(PHYSICS_TIMESTEP_SEC).toBeCloseTo(1 / 120, 12);
    expect(PHYSICS_MAX_SUBSTEPS).toBe(4);
    expect(MAX_FRAME_DELTA_SEC).toBeCloseTo(1 / 15, 12);
  });

  it('axes are orthonormal with +X downstream', () => {
    expect(DOWNSTREAM_AXIS).toEqual([1, 0, 0]);
    expect(UP_AXIS).toEqual([0, 1, 0]);
    expect(LATERAL_AXIS).toEqual([0, 0, 1]);
    const dotDL = DOWNSTREAM_AXIS[0] * LATERAL_AXIS[0]
      + DOWNSTREAM_AXIS[1] * LATERAL_AXIS[1]
      + DOWNSTREAM_AXIS[2] * LATERAL_AXIS[2];
    expect(dotDL).toBe(0);
  });

  it('mass-scaled force converges toward 1.0 without large overshoot drive', () => {
    let v = 0;
    const dt = PHYSICS_TIMESTEP_SEC;
    const profile = getProductPhysicsProfile('SKU-001');
    for (let i = 0; i < 240; i += 1) {
      const sample = computeBeltDriveForce({
        massKg: profile.massKg,
        linearVelocity: [v, 0, 0],
        maxBeltAccelerationMps2: profile.maxBeltAccelerationMps2,
        applyLateralCorrection: false,
      });
      v += (sample.force[0] / profile.massKg) * dt;
    }
    expect(v).toBeGreaterThan(0.98);
    expect(v).toBeLessThan(1.02 + BELT_SPEED_EPSILON);
  });

  it('heavier and lighter products both converge with mass-scaled force', () => {
    const run = (sku: string) => {
      let v = 0;
      const p = getProductPhysicsProfile(sku);
      for (let i = 0; i < 300; i += 1) {
        const s = computeBeltDriveForce({
          massKg: p.massKg,
          linearVelocity: [v, 0, 0],
          maxBeltAccelerationMps2: p.maxBeltAccelerationMps2,
          applyLateralCorrection: false,
        });
        v += (s.force[0] / p.massKg) * PHYSICS_TIMESTEP_SEC;
      }
      return v;
    };
    const light = run('SKU-009');
    const heavy = run('SKU-004');
    expect(light).toBeGreaterThan(0.95);
    expect(heavy).toBeGreaterThan(0.95);
    expect(light).toBeLessThan(1.05);
    expect(heavy).toBeLessThan(1.05);
  });

  it('deadband applies no forward correction near target', () => {
    const sample = computeBeltDriveForce({
      massKg: 1,
      linearVelocity: [1.0, 0, 0],
      maxBeltAccelerationMps2: 5,
      applyLateralCorrection: false,
    });
    expect(sample.withinDeadband).toBe(true);
    expect(sample.appliedAcceleration).toBe(0);
    expect(sample.force[0]).toBe(0);
  });

  it('no belt support when airborne or past belt end', () => {
    const half = colliderHalfHeight(getProductPhysicsProfile('SKU-001'));
    expect(isSupportedByBelt({
      position: [-3, BELT_TOP_Y + half + 0.1, 0],
      halfHeight: half,
      phase: 'physical_conveyor',
      linearVelY: 0,
    })).toBe(false);

    expect(isSupportedByBelt({
      position: [2.3, BELT_TOP_Y + half, 0],
      halfHeight: half,
      phase: 'physical_conveyor',
      linearVelY: 0,
    })).toBe(false);

    expect(isSupportedByBelt({
      position: [JUNCTION_ENTRY_S + 0.01, spawnCenterY(getProductPhysicsProfile('SKU-001')), 0],
      halfHeight: half,
      phase: 'junction',
      linearVelY: 0,
    })).toBe(true);
  });

  it('supported on belt top within clearance', () => {
    const half = colliderHalfHeight(getProductPhysicsProfile('SKU-001'));
    expect(isSupportedByBelt({
      position: [-3, spawnCenterY(getProductPhysicsProfile('SKU-001')), 0],
      halfHeight: half,
      phase: 'physical_conveyor',
      linearVelY: 0,
    })).toBe(true);
  });

  it('CCD enabled and spawn Y clears belt by 2mm', () => {
    const p = getProductPhysicsProfile('SKU-001');
    expect(p.ccd).toBe(true);
    expect(spawnCenterY(p)).toBeCloseTo(BELT_TOP_Y + colliderHalfHeight(p) + 0.002, 6);
  });

  it('profiles are ENGINEERING_DERIVED with primitive colliders', () => {
    for (const id of ['SKU-001', 'SKU-004', 'SKU-007', 'SKU-009']) {
      const p = getProductPhysicsProfile(id);
      expect(p.provenance).toBe('ENGINEERING_DERIVED');
      expect(['cuboid', 'cylinder', 'capsule']).toContain(p.collider.type);
      expect(p.restitution).toBeLessThanOrEqual(0.05);
    }
  });

  it('invalid state detection catches NaN and overspeed', () => {
    expect(isInvalidProductState({
      position: [0, NaN, 0],
      linearVelocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
    })).toBe(true);
    expect(isInvalidProductState({
      position: [0, 0.8, 0],
      linearVelocity: [5, 0, 0],
      angularVelocity: [0, 0, 0],
    })).toBe(true);
    expect(INVALID_PRODUCT_STATE_COUNT).toBe(0);
  });

  it('response time constant is 0.35 s', () => {
    expect(BELT_RESPONSE_TIME_SEC).toBe(0.35);
  });

  it('physical conveyor has no per-frame setTranslation and no handoff switch', async () => {
    const src = await import('../components/ThreeD/PhysicalPlaybackItemPhysics.tsx?raw');
    const text = (src as { default: string }).default;
    expect(text).toMatch(/dynamic_active/);
    expect(text).toMatch(/useBeforePhysicsStep/);
    expect(text).toMatch(/setLinvel/);
    expect(text).toMatch(/BELT_SPEED_MPS/);
    expect(text).not.toMatch(/getDropHandoffTimeMs/);
    expect(text).not.toMatch(/setLinvel\(\{ x: Math\.max/);
  });
});

describe('frozen routing contracts unchanged', () => {
  it('B/C/D mapping unchanged', () => {
    expect(categoryToPhysicalRoute('B')).toBe('STRAIGHT');
    expect(categoryToPhysicalRoute('C')).toBe('PHYSICAL_LEFT');
    expect(categoryToPhysicalRoute('D')).toBe('PHYSICAL_RIGHT');
  });

  it('LEFT/RIGHT angles and timing unchanged', () => {
    expect(DIVERTER_LEFT_SIGNED_DEG).toBe(-45);
    expect(DIVERTER_RIGHT_SIGNED_DEG).toBe(45);
    expect(rotationDurationSec()).toBeCloseTo(0.5, 6);
    expect(OPENING_SAFETY_MARGIN_SEC).toBeCloseTo(0.15, 6);
  });
});
