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

  it('B final pose is inside the b_receiver bin bounds', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 20000 });
    expect(pose.surface).toBe('b_bin_floor');
    expect(pose.isSettled).toBe(true);
    const b = SURFACES.b_bin_floor.bounds;
    expect(pose.position[0]).toBeGreaterThanOrEqual(b.minX);
    expect(pose.position[0]).toBeLessThanOrEqual(b.maxX);
    expect(pose.position[2]).toBeGreaterThanOrEqual(b.minZ);
    expect(pose.position[2]).toBeLessThanOrEqual(b.maxZ);
  });

  it('settled B item is NOT on the active belt', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 20000 });
    expect(['main_belt', 'b_transfer', 'inspection_station', 'routing_junction']).not.toContain(pose.surface);
    expect(pose.surface).toBe('b_bin_floor');
  });

  it('settled B item sits on bin floor not belt height', () => {
    const pose = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 9200 });
    expect(pose.surface).toBe('b_bin_floor');
    expect(pose.position[1]).toBeLessThan(0.35); // well below belt (0.7m)
    const b = SURFACES.b_bin_floor.bounds;
    expect(pose.position[0]).toBeGreaterThanOrEqual(b.minX);
    expect(pose.position[0]).toBeLessThanOrEqual(b.maxX);
  });

  it('settled B item remains fixed as time increases', () => {
    const t1 = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 11000 });
    const t2 = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 40000 });
    expect(t1.position).toEqual(t2.position);
    expect(t1.isSettled).toBe(true);
    expect(t2.isSettled).toBe(true);
  });

  it('B travels via belt transfer then drop chute before settling', () => {
    // routing starts at 6250 ms after discharge-aligned GATE retiming:
    // b_transfer t<0.35 -> <= 7125; chute 0.35..0.88 -> 7125..8450
    const transfer = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 6500 });
    expect(transfer.surface).toBe('b_transfer');
    expect(transfer.phase).toBe('routing');
    const chute = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 7800 });
    expect(chute.surface).toBe('chute_b');
    const settled = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 9500 });
    expect(settled.surface).toBe('b_bin_floor');
    expect(settled.phase).toBe('settled');
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

  it('B final pose fixed after +1000 ms', () => {
    const t0 = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 10000 });
    const t1 = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 11000 });
    expect(t0.surface).toBe('b_bin_floor');
    expect(t0.position).toEqual(t1.position);
  });

  it('no teleport between adjacent sampled poses', () => {
    let prev = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: 0 });
    for (let t = 100; t <= 10000; t += 100) {
      const cur = getPhysicalItemPose({ ...defaultInput, targetCategory: 'B', elapsedMs: t });
      const dx = cur.position[0] - prev.position[0];
      const dy = cur.position[1] - prev.position[1];
      const dz = cur.position[2] - prev.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).toBeLessThan(1.5); // max ~1m per 100ms at 1m/s
      prev = cur;
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
