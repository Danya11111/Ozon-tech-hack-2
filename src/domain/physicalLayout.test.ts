/**
 * Tests for physicalLayout constants and helpers.
 * Verifies physical realism constraints.
 */

import { describe, it, expect } from 'vitest';
import {
  BELT_TOP_Y,
  CONVEYOR_HEIGHT_M,
  CONVEYOR_SPEED_MPS,
  CONVEYOR_WIDTH_M,
  MAX_ITEM_HEIGHT_M,
  OVERSIZE_DEMO_MAX_HEIGHT_M,
  SENSOR_CLEARANCE_M,
  SENSOR_RIG_HEIGHT_M,
  CAMERA_RIG,
  LASER_HEIGHT_M,
  STEREO_CAMERA,
  ROLL_CAGE,
  getRenderedItemDimensions,
  getItemYOnBelt,
} from './physicalLayout';
import { ITEMS } from '../data/items';
import { DEMO_PLAYLIST } from './demoPlaylist';

describe('Physical Layout Constants', () => {
  it('belt top at 0.7m', () => {
    expect(BELT_TOP_Y).toBe(0.7);
  });

  it('conveyor speed 1 m/s', () => {
    expect(CONVEYOR_SPEED_MPS).toBe(1.0);
  });

  it('conveyor width 0.5m', () => {
    expect(CONVEYOR_WIDTH_M).toBe(0.5);
  });

  it('max item height 0.32m', () => {
    expect(MAX_ITEM_HEIGHT_M).toBe(0.32);
  });

  it('sensor rig above max item', () => {
    const maxItemTop = BELT_TOP_Y + OVERSIZE_DEMO_MAX_HEIGHT_M;
    expect(SENSOR_RIG_HEIGHT_M).toBeGreaterThan(maxItemTop);
    expect(SENSOR_RIG_HEIGHT_M).toBeGreaterThanOrEqual(maxItemTop + SENSOR_CLEARANCE_M);
  });

  it('camera rig above max item', () => {
    const maxItemTop = BELT_TOP_Y + OVERSIZE_DEMO_MAX_HEIGHT_M;
    expect(CAMERA_RIG.cameraY).toBeGreaterThan(maxItemTop);
    expect(CAMERA_RIG.height).toBeGreaterThan(maxItemTop);
  });

  it('laser above max item', () => {
    const maxItemTop = BELT_TOP_Y + OVERSIZE_DEMO_MAX_HEIGHT_M;
    expect(LASER_HEIGHT_M).toBeGreaterThan(maxItemTop);
  });

  it('stereo camera above max item', () => {
    const maxItemTop = BELT_TOP_Y + OVERSIZE_DEMO_MAX_HEIGHT_M;
    expect(STEREO_CAMERA.mountY).toBeGreaterThan(maxItemTop);
  });
});

describe('Roll Cage Dimensions', () => {
  it('C/D roll cage is 1.2x0.8x0.8m', () => {
    expect(ROLL_CAGE.width).toBe(1.2);
    expect(ROLL_CAGE.depth).toBe(0.8);
    expect(ROLL_CAGE.height).toBe(0.8);
  });
});

describe('getRenderedItemDimensions', () => {
  it('converts mm to meters correctly', () => {
    const result = getRenderedItemDimensions({ width: 300, depth: 200, height: 200 });
    expect(result.width).toBeCloseTo(0.3, 3);
    expect(result.depth).toBeCloseTo(0.2, 3);
    expect(result.height).toBeCloseTo(0.2, 3);
  });

  it('item rendered height <= expected physical height for normal items', () => {
    for (const item of ITEMS) {
      const dims = getRenderedItemDimensions(item.dimensionsMm);
      // Normal items should be <= 0.32m
      // Oversized items (like box-400) can be taller
      if (item.dimensionsMm.height <= 320) {
        expect(dims.height).toBeLessThanOrEqual(MAX_ITEM_HEIGHT_M + 0.01);
      }
    }
  });
});

describe('getItemYOnBelt', () => {
  it('item center Y = belt top + height/2', () => {
    const itemHeight = 0.2;
    const result = getItemYOnBelt(itemHeight);
    expect(result).toBe(BELT_TOP_Y + itemHeight / 2);
  });

  it('small item sits on belt correctly', () => {
    const itemHeight = 0.1;
    const centerY = getItemYOnBelt(itemHeight);
    const bottomY = centerY - itemHeight / 2;
    expect(bottomY).toBeCloseTo(BELT_TOP_Y, 3);
  });

  it('tallest item bottom at belt top', () => {
    const itemHeight = OVERSIZE_DEMO_MAX_HEIGHT_M;
    const centerY = getItemYOnBelt(itemHeight);
    const bottomY = centerY - itemHeight / 2;
    expect(bottomY).toBeCloseTo(BELT_TOP_Y, 3);
  });
});

describe('Playlist Items Physical Constraints', () => {
  it('all playlist categories map to ROUTE_TO_B/C/D', () => {
    for (const c of DEMO_PLAYLIST) {
      const command = `ROUTE_TO_${c.expectedCategory}`;
      expect(['ROUTE_TO_B', 'ROUTE_TO_C', 'ROUTE_TO_D']).toContain(command);
    }
  });

  it('playlist has 8 cases', () => {
    expect(DEMO_PLAYLIST).toHaveLength(8);
  });

  it('low confidence case still has B/C/D category', () => {
    const lowConfCase = DEMO_PLAYLIST.find(c => c.id === 'low_confidence');
    expect(lowConfCase).toBeDefined();
    expect(['B', 'C', 'D']).toContain(lowConfCase!.expectedCategory);
  });
});

describe('Speed Calculation', () => {
  it('1 meter per second', () => {
    // At 1 m/s, in 1 second item moves 1 meter
    const speed = CONVEYOR_SPEED_MPS;
    const time = 1.0; // seconds
    const distance = speed * time;
    expect(distance).toBe(1.0);
  });

  it('5 meter path takes 5 seconds at 1 m/s', () => {
    const pathLength = 5.0; // meters
    const expectedTime = pathLength / CONVEYOR_SPEED_MPS;
    expect(expectedTime).toBe(5.0);
  });
});
