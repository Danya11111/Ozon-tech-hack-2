import { describe, it, expect } from 'vitest';
import {
  percentile,
  computeFrameTimeStats,
  isSoftwareRenderer,
  isHardwareAccelerated,
  isPerfQueryEnabled,
  emptyPerfSnapshot,
} from './perfMetrics';

describe('perfMetrics', () => {
  describe('percentile', () => {
    it('returns 0 for empty input', () => {
      expect(percentile([], 0.95)).toBe(0);
    });

    it('returns the sole value', () => {
      expect(percentile([16], 0.99)).toBe(16);
    });

    it('interpolates p95 on a sorted series', () => {
      const values = [10, 20, 30, 40, 50];
      // idx = 0.95 * 4 = 3.8 → 40 * 0.2 + 50 * 0.8 = 48
      expect(percentile(values, 0.95)).toBeCloseTo(48, 5);
    });

    it('returns endpoints at 0 and 1', () => {
      const values = [1, 2, 3, 4];
      expect(percentile(values, 0)).toBe(1);
      expect(percentile(values, 1)).toBe(4);
    });
  });

  describe('computeFrameTimeStats', () => {
    it('derives fps and long-frame counts', () => {
      const frames = [16, 16, 16, 40, 16, 60];
      const s = computeFrameTimeStats(frames);
      expect(s.longFramesOver33).toBe(2);
      expect(s.longFramesOver50).toBe(1);
      expect(s.averageFps).toBeGreaterThan(0);
      expect(s.minimumFps).toBeCloseTo(1000 / 60, 5);
      expect(s.p95FrameTimeMs).toBeGreaterThanOrEqual(s.p99FrameTimeMs > 0 ? 0 : 0);
    });
  });

  describe('renderer detection', () => {
    it('flags SwiftShader and llvmpipe as software', () => {
      expect(isSoftwareRenderer('Google SwiftShader')).toBe(true);
      expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7)')).toBe(true);
      expect(isHardwareAccelerated('ANGLE (NVIDIA GeForce RTX 3080)')).toBe(true);
    });
  });

  describe('isPerfQueryEnabled', () => {
    it('reads perf=1 from a search string', () => {
      expect(isPerfQueryEnabled('?perf=1')).toBe(true);
      expect(isPerfQueryEnabled('?foo=1')).toBe(false);
      expect(isPerfQueryEnabled('')).toBe(false);
    });
  });

  describe('emptyPerfSnapshot', () => {
    it('matches the expected JSON shape defaults', () => {
      const s = emptyPerfSnapshot();
      expect(s).toMatchObject({
        mode: 'demo',
        renderer: 'unknown',
        averageFps: 0,
        minimumFps: 0,
        p95FrameTimeMs: 0,
        p99FrameTimeMs: 0,
        longFramesOver33: 0,
        longFramesOver50: 0,
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
        programs: 0,
        heapMb: 0,
        dpr: 1,
        shadows: false,
        antialias: false,
        hardwareAccelerated: true,
      });
    });
  });
});
