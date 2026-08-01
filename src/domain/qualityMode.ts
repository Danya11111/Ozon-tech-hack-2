/**
 * Render quality modes adapted to device capability and demo needs.
 * Demo/Ultra targets stable 60 FPS when hardware allows; falls back gracefully.
 */

export type QualityMode = 'low' | 'medium' | 'high' | 'demo';

export interface QualitySettings {
  mode: QualityMode;
  dprMax: number;
  antialias: boolean;
  shadows: boolean;
  maxVisibleItems: number;
  effectsEnabled: boolean;
  rollerDetail: 'none' | 'sparse' | 'full';
  targetFps: 30 | 60;
}

const PRESETS: Record<QualityMode, QualitySettings> = {
  low: {
    mode: 'low',
    dprMax: 1,
    antialias: false,
    shadows: false,
    maxVisibleItems: 3,
    effectsEnabled: false,
    rollerDetail: 'none',
    targetFps: 30,
  },
  medium: {
    mode: 'medium',
    dprMax: 1.25,
    antialias: false,
    shadows: false,
    maxVisibleItems: 5,
    effectsEnabled: false,
    rollerDetail: 'sparse',
    targetFps: 30,
  },
  high: {
    mode: 'high',
    dprMax: 1.5,
    antialias: true,
    shadows: true,
    maxVisibleItems: 6,
    effectsEnabled: false,
    rollerDetail: 'full',
    targetFps: 60,
  },
  demo: {
    mode: 'demo',
    // Desktop polish: 1.5 DPR keeps edges sharp without a heavy post stack.
    dprMax: 1.5,
    antialias: true,
    shadows: true,
    maxVisibleItems: 4,
    effectsEnabled: false,
    rollerDetail: 'full',
    targetFps: 60,
  },
};

/** Auto-select quality from viewport width and optional FPS sample. */
export function detectQualityMode(width: number, recentFps?: number): QualityMode {
  if (width < 768) return 'low';
  if (width < 1100) return 'medium';
  if (recentFps !== undefined && recentFps < 28) return 'low';
  if (recentFps !== undefined && recentFps < 45) return 'medium';
  return 'demo';
}

export function getQualitySettings(mode: QualityMode): QualitySettings {
  return PRESETS[mode];
}

/** Soft downgrade when FPS drops below target. */
export function adaptQuality(current: QualityMode, fps: number): QualityMode {
  const order: QualityMode[] = ['low', 'medium', 'high', 'demo'];
  const idx = order.indexOf(current);
  const target = getQualitySettings(current).targetFps;
  if (fps < target * 0.7 && idx > 0) return order[idx - 1];
  if (fps > target * 0.95 && idx < order.length - 1 && current !== 'demo') {
    return order[Math.min(idx + 1, order.length - 1)];
  }
  return current;
}
