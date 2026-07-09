/**
 * Tests for cinematicCamera module.
 */

import { describe, it, expect } from 'vitest';
import {
  getCameraModeForPhase,
  getCameraConfig,
  smoothCameraTransition,
  isValidCameraConfig,
  phaseHasCameraMode,
  getInitialCameraConfig,
  getAllCameraModes,
  getViewportType,
  lerpVector3,
  lerp,
} from './cinematicCamera';
import { CASE_PHASES } from './continuousPlayback';
import type { Category } from './types';

describe('getCameraModeForPhase', () => {
  it('returns a mode for every playback phase', () => {
    for (const phaseConfig of CASE_PHASES) {
      const mode = getCameraModeForPhase(phaseConfig.phase);
      expect(mode).toBeTruthy();
      expect(typeof mode).toBe('string');
    }
  });

  it('spawn returns feedCloseup', () => {
    expect(getCameraModeForPhase('spawn')).toBe('feedCloseup');
  });

  it('detection returns inspectionTop', () => {
    expect(getCameraModeForPhase('detection')).toBe('inspectionTop');
  });

  it('routing returns chuteCloseup', () => {
    expect(getCameraModeForPhase('routing')).toBe('chuteCloseup');
  });
});

describe('getCameraConfig', () => {
  it('returns valid config for all phases', () => {
    for (const phaseConfig of CASE_PHASES) {
      const config = getCameraConfig(phaseConfig.phase, 'B', null, 'desktop');
      expect(isValidCameraConfig(config)).toBe(true);
    }
  });

  it('camera position/target are finite numbers', () => {
    const config = getCameraConfig('detection', 'B', [0, 0.8, 0], 'desktop');
    expect(config.position.every(n => Number.isFinite(n))).toBe(true);
    expect(config.target.every(n => Number.isFinite(n))).toBe(true);
  });

  it('fov within reasonable range (10-120)', () => {
    for (const phaseConfig of CASE_PHASES) {
      const config = getCameraConfig(phaseConfig.phase, 'C', null, 'desktop');
      expect(config.fov).toBeGreaterThan(10);
      expect(config.fov).toBeLessThan(120);
    }
  });

  it('target category B/C/D maps to routing camera', () => {
    const categories: Category[] = ['B', 'C', 'D'];
    for (const cat of categories) {
      const config = getCameraConfig('routing', cat, null, 'desktop');
      expect(config.mode).toBe('chuteCloseup');
      expect(isValidCameraConfig(config)).toBe(true);
    }
  });

  it('adjusts for viewport type', () => {
    const desktop = getCameraConfig('move_to_detection', 'B', null, 'desktop');
    const mobile = getCameraConfig('move_to_detection', 'B', null, 'mobile');
    
    // Mobile should have higher camera and wider FOV
    expect(mobile.position[1]).toBeGreaterThan(desktop.position[1]);
    expect(mobile.fov).toBeGreaterThan(desktop.fov);
  });
});

describe('smoothCameraTransition', () => {
  it('interpolates between configs', () => {
    const current = getCameraConfig('spawn', 'B', null, 'desktop');
    const target = getCameraConfig('detection', 'B', null, 'desktop');
    
    const result = smoothCameraTransition(current, target, 0.5);
    
    // Result should be between current and target
    expect(result.position[0]).toBeGreaterThanOrEqual(
      Math.min(current.position[0], target.position[0])
    );
    expect(result.position[0]).toBeLessThanOrEqual(
      Math.max(current.position[0], target.position[0])
    );
  });
});

describe('isValidCameraConfig', () => {
  it('returns true for valid config', () => {
    const config = getInitialCameraConfig();
    expect(isValidCameraConfig(config)).toBe(true);
  });

  it('returns false for invalid fov', () => {
    const config = { ...getInitialCameraConfig(), fov: 5 };
    expect(isValidCameraConfig(config)).toBe(false);
  });

  it('returns false for NaN position', () => {
    const config = { ...getInitialCameraConfig(), position: [NaN, 0, 0] as [number, number, number] };
    expect(isValidCameraConfig(config)).toBe(false);
  });
});

describe('phaseHasCameraMode', () => {
  it('returns true for all phases', () => {
    for (const phaseConfig of CASE_PHASES) {
      expect(phaseHasCameraMode(phaseConfig.phase)).toBe(true);
    }
  });
});

describe('getViewportType', () => {
  it('desktop for width >= 1200', () => {
    expect(getViewportType(1920)).toBe('desktop');
    expect(getViewportType(1200)).toBe('desktop');
  });

  it('laptop for width 768-1199', () => {
    expect(getViewportType(1024)).toBe('laptop');
    expect(getViewportType(768)).toBe('laptop');
  });

  it('mobile for width < 768', () => {
    expect(getViewportType(390)).toBe('mobile');
    expect(getViewportType(767)).toBe('mobile');
  });
});

describe('lerp utilities', () => {
  it('lerp returns midpoint at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('lerpVector3 works correctly', () => {
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [10, 20, 30];
    const result = lerpVector3(a, b, 0.5);
    expect(result).toEqual([5, 10, 15]);
  });
});

describe('getAllCameraModes', () => {
  it('returns all defined modes', () => {
    const modes = getAllCameraModes();
    expect(modes).toContain('overview');
    expect(modes).toContain('feedCloseup');
    expect(modes).toContain('inspectionTop');
    expect(modes).toContain('measurementSide');
    expect(modes).toContain('routingWide');
    expect(modes).toContain('chuteCloseup');
    expect(modes).toContain('resultZone');
    expect(modes.length).toBeGreaterThanOrEqual(8);
  });
});
