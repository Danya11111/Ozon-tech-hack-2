import { describe, it, expect } from 'vitest';
import { getPhysicalItemPose } from './physicalItemMotion';
import { ZONES, BELT_TOP_Y, CONVEYOR_SPEED_MPS } from './physicalLayout';

describe('physicalItemMotion', () => {
  const defaultInput = {
    caseId: 'test_case',
    dimensionsMm: { width: 300, depth: 200, height: 200 }, // 0.2m height
    targetCategory: 'B' as any,
    elapsedMs: 0,
    slotIndex: 0
  };

  it('starts at spawn point on the belt', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, elapsedMs: 0 });
    expect(pose.surface).toBe('belt');
    expect(pose.position[0]).toBe(ZONES.A.x);
    expect(pose.position[1]).toBe(BELT_TOP_Y + 0.1); // 0.7 + 0.1
    expect(pose.phase).toBe('feed');
  });

  it('moves at 1 m/s along the belt during move_to_detection', () => {
    // move_to_detection starts at 300ms
    const pose = getPhysicalItemPose({ ...defaultInput, elapsedMs: 1300 });
    const distance = 1000 / 1000 * CONVEYOR_SPEED_MPS; // 1.0 m
    expect(pose.position[0]).toBeCloseTo(ZONES.A.x + distance, 2);
    expect(pose.surface).toBe('belt');
  });

  it('stays in C cage for category C after routing is complete', () => {
    // 9800ms is the total duration
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'C', elapsedMs: 10000 });
    expect(pose.isSettled).toBe(true);
    expect(pose.surface).toBe('c_cage');
    expect(pose.position[0]).toBeCloseTo(ZONES.C.x - 0.2, 1);
    expect(pose.position[2]).toBeCloseTo(ZONES.C.z - 0.1, 1);
    expect(pose.position[1]).toBeCloseTo(0.1 + 0.1, 2); // floor + half height
  });

  it('stays in D cage for category D after routing is complete', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'D', elapsedMs: 10000 });
    expect(pose.isSettled).toBe(true);
    expect(pose.surface).toBe('d_cage');
    expect(pose.position[0]).toBeCloseTo(ZONES.D.x - 0.2, 1);
    expect(pose.position[2]).toBeCloseTo(ZONES.D.z - 0.1, 1);
  });
});
