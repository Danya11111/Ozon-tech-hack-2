import { describe, it, expect } from 'vitest';
import {
  SURFACES,
  getSurface,
  isWithinBounds,
  surfaceLength,
  pathForCategory,
  type SurfaceName,
} from './conveyorNetwork';

const ALL: SurfaceName[] = [
  'main_belt',
  'inspection_station',
  'routing_junction',
  'b_transfer',
  'chute_b',
  'b_bin_floor',
  'chute_c',
  'chute_d',
  'c_cage_floor',
  'd_cage_floor',
];

describe('conveyorNetwork', () => {
  it('defines every required surface', () => {
    for (const name of ALL) {
      expect(SURFACES[name]).toBeDefined();
      expect(getSurface(name).name).toBe(name);
    }
  });

  it('every surface has finite coordinates and bounds', () => {
    for (const name of ALL) {
      const s = SURFACES[name];
      for (const v of [...s.start, ...s.end, s.surfaceY, s.width, s.speedMps]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      const b = s.bounds;
      for (const v of [b.minX, b.maxX, b.minZ, b.maxZ]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(b.maxX).toBeGreaterThanOrEqual(b.minX);
      expect(b.maxZ).toBeGreaterThanOrEqual(b.minZ);
    }
  });

  it('main belt runs at 1 m/s and cages/junctions are static', () => {
    expect(SURFACES.main_belt.speedMps).toBe(1);
    expect(SURFACES.routing_junction.speedMps).toBe(1);
    expect(SURFACES.c_cage_floor.speedMps).toBe(0);
    expect(SURFACES.d_cage_floor.speedMps).toBe(0);
    expect(SURFACES.inspection_station.speedMps).toBe(0);
  });

  it('chutes move slower than the belt but are not static', () => {
    expect(SURFACES.chute_c.speedMps).toBeGreaterThan(0);
    expect(SURFACES.chute_c.speedMps).toBeLessThan(SURFACES.main_belt.speedMps);
  });

  it('provides an ordered path per category', () => {
    expect(pathForCategory('B')).toEqual(['main_belt', 'inspection_station', 'routing_junction', 'b_transfer', 'chute_b', 'b_bin_floor']);
    expect(pathForCategory('C')).toEqual(['main_belt', 'inspection_station', 'routing_junction', 'chute_c', 'c_cage_floor']);
    expect(pathForCategory('D')).toEqual(['main_belt', 'inspection_station', 'routing_junction', 'chute_d', 'd_cage_floor']);
  });

  it('B bin floor and cages are on the ground (not floating)', () => {
    expect(SURFACES.b_bin_floor.surfaceY).toBeLessThan(0.2);
    expect(SURFACES.c_cage_floor.surfaceY).toBeLessThan(0.2);
    expect(SURFACES.d_cage_floor.surfaceY).toBeLessThan(0.2);
  });

  it('bounds check works', () => {
    const c = SURFACES.c_cage_floor.bounds;
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    expect(isWithinBounds('c_cage_floor', cx, cz)).toBe(true);
    expect(isWithinBounds('c_cage_floor', c.maxX + 1, cz)).toBe(false);
  });

  it('every surface has a kind', () => {
    for (const name of ALL) {
      expect(SURFACES[name].kind).toBeTruthy();
    }
    expect(SURFACES.b_bin_floor.kind).toBe('bin_floor');
    expect(SURFACES.b_transfer.kind).toBe('conveyor');
  });

  it('chutes have real length (item slides, does not teleport)', () => {
    expect(surfaceLength('chute_c')).toBeGreaterThan(0.5);
    expect(surfaceLength('chute_d')).toBeGreaterThan(0.5);
  });
});
