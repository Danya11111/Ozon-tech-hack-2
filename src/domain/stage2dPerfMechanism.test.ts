import { describe, expect, it } from 'vitest';
import { PUSHER } from './pusherMotion';
import { assertRuntimeHeadlessParity } from './physicsConfigHash';
import { getQualitySettings } from './qualityMode';

describe('Stage 2D mechanism + performance policy', () => {
  it('keeps documented paddle dimensions for SPEC_DERIVED_CAD', () => {
    expect(PUSHER.halfExtents).toEqual([0.5, 0.14, 0.025]);
    expect(PUSHER.strokeLength).toBe(1.62);
  });

  it('caps demo/high DPR at 1.25', () => {
    expect(getQualitySettings('demo').dprMax).toBe(1.25);
    expect(getQualitySettings('high').dprMax).toBe(1.25);
  });

  it('preserves runtime/headless hash parity', () => {
    const p = assertRuntimeHeadlessParity();
    expect(p.equal).toBe(true);
    expect(p.runtime).toBe('7ee15ad3e879a44a');
  });
});
