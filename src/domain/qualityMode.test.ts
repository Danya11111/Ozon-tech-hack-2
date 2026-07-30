/**
 * Quality mode unit tests.
 */
import { describe, it, expect } from 'vitest';
import { detectQualityMode, getQualitySettings, adaptQuality } from './qualityMode';

describe('qualityMode', () => {
  it('selects low on narrow viewports', () => {
    expect(detectQualityMode(600)).toBe('low');
  });

  it('selects demo on wide viewports with healthy FPS', () => {
    expect(detectQualityMode(1440, 60)).toBe('demo');
  });

  it('downgrades when FPS collapses', () => {
    expect(detectQualityMode(1440, 20)).toBe('low');
  });

  it('demo preset: premium shadows on (Stage 2), expensive effects stay off for stable FPS', () => {
    const s = getQualitySettings('demo');
    expect(s.effectsEnabled).toBe(false);
    expect(s.shadows).toBe(true); // Stage 2: PCFSoft contact shadows in the default premium look
    expect(s.targetFps).toBe(60);
  });

  it('adaptQuality steps down under load', () => {
    expect(adaptQuality('demo', 20)).toBe('high');
  });
});
