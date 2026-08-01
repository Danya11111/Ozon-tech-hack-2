import { describe, expect, it } from 'vitest';
import {
  GATE_VANE,
  PUSHER,
  DIVERTER_LEFT_SIGNED_DEG,
  DIVERTER_RIGHT_SIGNED_DEG,
  OPENING_SAFETY_MARGIN_SEC,
  rotationDurationSec,
  categoryToPhysicalRoute,
  physicalRouteToActiveDiverter,
} from './pusherMotion';
import { assertRuntimeHeadlessParity } from './physicsConfigHash';
import { getQualitySettings } from './qualityMode';

describe('Stage 2D mechanism + performance policy', () => {
  it('keeps frozen CAD diverter kinematics (angles, duration, vane size)', () => {
    expect(GATE_VANE.halfExtents).toEqual([0.375, 0.05, 0.02]);
    expect(PUSHER.halfExtents).toEqual(GATE_VANE.halfExtents);
    expect(GATE_VANE.activeDeg).toBe(45);
    expect(DIVERTER_LEFT_SIGNED_DEG).toBe(-45);
    expect(DIVERTER_RIGHT_SIGNED_DEG).toBe(45);
    expect(rotationDurationSec()).toBeCloseTo(0.5, 5);
    expect(OPENING_SAFETY_MARGIN_SEC).toBe(0.15);
    expect(PUSHER.holdSec).toBe(GATE_VANE.holdSec);
  });

  it('maps B/C/D to straight / left / right CAD diverters', () => {
    expect(categoryToPhysicalRoute('B')).toBe('STRAIGHT');
    expect(physicalRouteToActiveDiverter('STRAIGHT')).toBe('NONE');
    expect(categoryToPhysicalRoute('C')).toBe('PHYSICAL_LEFT');
    expect(physicalRouteToActiveDiverter('PHYSICAL_LEFT')).toBe('LEFT');
    expect(categoryToPhysicalRoute('D')).toBe('PHYSICAL_RIGHT');
    expect(physicalRouteToActiveDiverter('PHYSICAL_RIGHT')).toBe('RIGHT');
  });

  it('caps demo/high DPR at 1.5 for desktop polish', () => {
    expect(getQualitySettings('demo').dprMax).toBe(1.5);
    expect(getQualitySettings('high').dprMax).toBe(1.5);
    expect(getQualitySettings('medium').dprMax).toBeLessThanOrEqual(1.25);
    expect(getQualitySettings('low').dprMax).toBe(1);
  });

  it('preserves runtime/headless hash parity', () => {
    const p = assertRuntimeHeadlessParity();
    expect(p.equal).toBe(true);
    expect(p.runtime).toMatch(/^[a-f0-9]{16}$/);
  });
});
