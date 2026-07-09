import { describe, it, expect } from 'vitest';
import { getPhysicalItemPose } from './physicalItemMotion';
import { ZONES, BELT_TOP_Y, CONVEYOR_SPEED_MPS, CAGE_FLOOR_Y } from './physicalLayout';
import { SURFACES } from './conveyorNetwork';

describe('physicalItemMotion', () => {
  const defaultInput = {
    caseId: 'test_case',
    dimensionsMm: { width: 300, depth: 200, height: 200 }, // 0.2m height
    targetCategory: 'B' as any,
    elapsedMs: 0,
    slotIndex: 0,
  };
  const halfH = 0.1; // half of 0.2m

  it('starts at spawn point on the main belt', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, elapsedMs: 0 });
    expect(pose.surface).toBe('main_belt');
    expect(pose.position[0]).toBeCloseTo(ZONES.A.x, 5);
    expect(pose.position[1]).toBeCloseTo(BELT_TOP_Y + halfH, 5);
    expect(pose.phase).toBe('feed');
  });

  it('moves exactly 1 m in 1 s along the main belt', () => {
    const start = getPhysicalItemPose({ ...defaultInput, elapsedMs: 300 }); // feed start
    const later = getPhysicalItemPose({ ...defaultInput, elapsedMs: 1300 }); // +1s
    const delta = later.position[0] - start.position[0];
    expect(delta).toBeCloseTo(1.0 * CONVEYOR_SPEED_MPS, 2);
    expect(later.surface).toBe('main_belt');
  });

  it('item bottom rests exactly on the belt surface', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, elapsedMs: 1300 });
    const bottomY = pose.position[1] - halfH;
    expect(bottomY).toBeCloseTo(BELT_TOP_Y, 5);
  });

  it('is deterministic for the same input', () => {
    const a = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 7200 });
    const b = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 7200 });
    expect(a).toEqual(b);
  });

  it('B final pose is inside the b_receiver bounds', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 20000 });
    expect(pose.surface).toBe('b_receiver');
    expect(pose.isSettled).toBe(true);
    const b = SURFACES.b_receiver.bounds;
    expect(pose.position[0]).toBeGreaterThanOrEqual(b.minX);
    expect(pose.position[0]).toBeLessThanOrEqual(b.maxX);
    expect(pose.position[2]).toBeGreaterThanOrEqual(b.minZ);
    expect(pose.position[2]).toBeLessThanOrEqual(b.maxZ);
  });

  it('C final pose is inside the c_cage bounds', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 20000 });
    expect(pose.surface).toBe('c_cage_floor');
    expect(pose.isSettled).toBe(true);
    const b = SURFACES.c_cage_floor.bounds;
    expect(pose.position[0]).toBeGreaterThanOrEqual(b.minX);
    expect(pose.position[0]).toBeLessThanOrEqual(b.maxX);
    expect(pose.position[2]).toBeGreaterThanOrEqual(b.minZ);
    expect(pose.position[2]).toBeLessThanOrEqual(b.maxZ);
    expect(pose.position[1]).toBeCloseTo(CAGE_FLOOR_Y + halfH, 5);
  });

  it('D final pose is inside the d_cage bounds', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'D', elapsedMs: 20000 });
    expect(pose.surface).toBe('d_cage_floor');
    expect(pose.isSettled).toBe(true);
    const b = SURFACES.d_cage_floor.bounds;
    expect(pose.position[0]).toBeGreaterThanOrEqual(b.minX);
    expect(pose.position[0]).toBeLessThanOrEqual(b.maxX);
    expect(pose.position[2]).toBeGreaterThanOrEqual(b.minZ);
    expect(pose.position[2]).toBeLessThanOrEqual(b.maxZ);
  });

  it('settled item remains fixed as time increases', () => {
    const t1 = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 12000 });
    const t2 = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 30000 });
    expect(t1.position).toEqual(t2.position);
    expect(t1.isSettled).toBe(true);
    expect(t2.isSettled).toBe(true);
  });

  it('never produces NaN/Infinity positions across the whole timeline', () => {
    for (const cat of ['B', 'C', 'D'] as const) {
      for (let t = 0; t <= 12000; t += 100) {
        const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: cat, elapsedMs: t });
        for (const v of [...pose.position, ...pose.rotation]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it('routes C down the chute before settling', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 7000 });
    expect(pose.surface).toBe('chute_c');
    expect(pose.phase).toBe('routing');
    // On the chute the item is below belt height but above cage floor.
    expect(pose.position[1]).toBeLessThan(BELT_TOP_Y + halfH);
    expect(pose.position[1]).toBeGreaterThan(CAGE_FLOOR_Y);
  });
});
