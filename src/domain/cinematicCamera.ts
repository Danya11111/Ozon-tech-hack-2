/**
 * Cinematic Camera Director — controls camera angles during demo playback.
 * Returns camera position, target, and FOV based on current phase and item state.
 */

import type { CasePhase } from './continuousPlayback';
import type { Category } from './types';
import { ZONES, BELT_TOP_Y, CAMERA_RIG } from './physicalLayout';

/** Camera mode names for different shot types. */
export type CameraMode = 
  | 'overview'
  | 'feedCloseup'
  | 'inspectionTop'
  | 'measurementSide'
  | 'classificationTop'
  | 'routingWide'
  | 'chuteCloseup'
  | 'resultZone'
  | 'nextItemReset';

/** Camera configuration for a specific mode. */
export interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  mode: CameraMode;
}

/** Viewport type for adaptive camera positions. */
export type ViewportType = 'desktop' | 'laptop' | 'mobile';

/**
 * Get viewport type based on screen width.
 */
export function getViewportType(width: number): ViewportType {
  if (width >= 1200) return 'desktop';
  if (width >= 768) return 'laptop';
  return 'mobile';
}

/**
 * Viewport adjustments for camera height/distance.
 */
const VIEWPORT_ADJUSTMENTS: Record<ViewportType, { heightMult: number; distMult: number }> = {
  desktop: { heightMult: 1.0, distMult: 1.0 },
  laptop: { heightMult: 1.15, distMult: 1.1 },
  mobile: { heightMult: 1.3, distMult: 1.25 },
};

/**
 * Base camera configurations for each mode.
 * Positions are relative to the scene center or specific zones.
 */
const BASE_CAMERA_CONFIGS: Record<CameraMode, Omit<CameraConfig, 'mode'>> = {
  // Full product line: 3 CAD modules + close-in B/C/D baskets.
  overview: {
    position: [0.35, 2.35, 5.1],
    target: [-0.55, 0.55, 0.05],
    fov: 36,
  },
  feedCloseup: {
    position: [ZONES.A.x + 1.5, 2.0, 2.0],
    target: [ZONES.A.x, BELT_TOP_Y + 0.1, 0],
    fov: 45,
  },
  inspectionTop: {
    position: [ZONES.CAMERA.x, CAMERA_RIG.cameraY + 1.5, 2.5],
    target: [ZONES.CAMERA.x, BELT_TOP_Y + 0.1, 0],
    fov: 40,
  },
  measurementSide: {
    position: [ZONES.CAMERA.x + 1.8, 1.2, 2.0],
    target: [ZONES.CAMERA.x, BELT_TOP_Y + 0.2, 0],
    fov: 42,
  },
  classificationTop: {
    position: [ZONES.CAMERA.x + 0.5, 2.5, 2.2],
    target: [ZONES.CAMERA.x, BELT_TOP_Y + 0.15, 0],
    fov: 45,
  },
  routingWide: {
    position: [2.2, 2.4, 4.0],
    target: [ZONES.GATE.x, BELT_TOP_Y, 0.15],
    fov: 48,
  },
  chuteCloseup: {
    position: [ZONES.GATE.x + 0.5, 1.8, 2.8],
    target: [ZONES.GATE.x + 0.3, BELT_TOP_Y, 0.8],
    fov: 48,
  },
  resultZone: {
    position: [3.5, 2.5, 3.5],
    target: [ZONES.B.x - 0.5, 0.5, 0],
    fov: 52,
  },
  nextItemReset: {
    position: [0.35, 2.35, 5.1],
    target: [-0.55, 0.55, 0.05],
    fov: 36,
  },
};

/**
 * Get camera mode for a given phase.
 */
export function getCameraModeForPhase(phase: CasePhase): CameraMode {
  switch (phase) {
    case 'spawn':
      return 'feedCloseup';
    case 'move_to_detection':
      return 'overview';
    case 'detection':
      return 'inspectionTop';
    case 'measurement':
      return 'measurementSide';
    case 'classification':
      return 'classificationTop';
    case 'command_sent':
      return 'routingWide';
    case 'routing':
      return 'chuteCloseup';
    case 'exit':
      return 'resultZone';
    case 'clear_gap':
      return 'nextItemReset';
    case 'fault_hold':
    case 'emergency_hold':
      return 'routingWide';
    case 'recover':
      return 'overview';
    default:
      return 'overview';
  }
}

/**
 * Adjust camera position for target category (C/D routing).
 */
function adjustForCategory(
  config: CameraConfig, 
  category: Category | null, 
  phase: CasePhase
): CameraConfig {
  if (!category || !['routing', 'exit'].includes(phase)) {
    return config;
  }

  const adjusted = { ...config, position: [...config.position] as [number, number, number], target: [...config.target] as [number, number, number] };
  
  if (category === 'C') {
    // Look toward C zone (positive Z)
    adjusted.target[2] = 1.2;
    adjusted.position[2] = 3.5;
  } else if (category === 'D') {
    // Look toward D zone (negative Z)
    adjusted.target[2] = -1.2;
    adjusted.position[2] = -2.5;
    adjusted.position[0] = 3.0;
  }
  // B stays on main line, no adjustment needed
  
  return adjusted;
}

/**
 * Adjust camera for viewport size.
 */
function adjustForViewport(
  config: CameraConfig,
  viewport: ViewportType
): CameraConfig {
  const adj = VIEWPORT_ADJUSTMENTS[viewport];
  
  return {
    ...config,
    position: [
      config.position[0] * adj.distMult,
      config.position[1] * adj.heightMult,
      config.position[2] * adj.distMult,
    ],
    fov: config.fov + (viewport === 'mobile' ? 8 : viewport === 'laptop' ? 4 : 0),
  };
}

/**
 * Get camera configuration for the current playback state.
 * @param phase Current case phase
 * @param category Target category (B/C/D)
 * @param itemPosition Current item position [x, y, z]
 * @param viewport Viewport type for adaptive positioning
 * @returns Camera configuration
 */
export function getCameraConfig(
  phase: CasePhase,
  category: Category | null,
  itemPosition: [number, number, number] | null,
  viewport: ViewportType = 'desktop'
): CameraConfig {
  const mode = getCameraModeForPhase(phase);
  const baseConfig = BASE_CAMERA_CONFIGS[mode];
  
  let config: CameraConfig = {
    ...baseConfig,
    mode,
  };
  
  // Adjust for category-specific routing
  config = adjustForCategory(config, category, phase);
  
  // Adjust for viewport
  config = adjustForViewport(config, viewport);
  
  // Follow item during movement phases
  if (itemPosition && ['move_to_detection', 'routing', 'exit'].includes(phase)) {
    // Partially follow item with smoothing factor
    const followWeight = phase === 'move_to_detection' ? 0.3 : 0.5;
    config.target = [
      config.target[0] * (1 - followWeight) + itemPosition[0] * followWeight,
      config.target[1] * (1 - followWeight) + itemPosition[1] * followWeight,
      config.target[2] * (1 - followWeight) + itemPosition[2] * followWeight,
    ];
  }
  
  return config;
}

/**
 * Lerp (linear interpolation) between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Lerp between two 3D vectors.
 */
export function lerpVector3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

/**
 * Smoothly interpolate camera configuration.
 * @param current Current camera state
 * @param target Target camera state
 * @param smoothing Smoothing factor (0-1, lower = smoother)
 */
export function smoothCameraTransition(
  current: CameraConfig,
  target: CameraConfig,
  smoothing: number = 0.08
): CameraConfig {
  return {
    position: lerpVector3(current.position, target.position, smoothing),
    target: lerpVector3(current.target, target.target, smoothing),
    fov: lerp(current.fov, target.fov, smoothing),
    mode: target.mode,
  };
}

/**
 * Get initial camera config (product overview framing).
 */
export function getInitialCameraConfig(viewport: ViewportType = 'desktop'): CameraConfig {
  return adjustForViewport(
    { ...BASE_CAMERA_CONFIGS.overview, mode: 'overview' },
    viewport,
  );
}

/**
 * Validate camera config has finite numbers.
 */
export function isValidCameraConfig(config: CameraConfig): boolean {
  const allFinite = (arr: number[]) => arr.every(n => Number.isFinite(n));
  return (
    allFinite(config.position) &&
    allFinite(config.target) &&
    Number.isFinite(config.fov) &&
    config.fov > 10 &&
    config.fov < 120
  );
}

/**
 * Get all camera modes.
 */
export function getAllCameraModes(): CameraMode[] {
  return Object.keys(BASE_CAMERA_CONFIGS) as CameraMode[];
}

/**
 * Check if phase has associated camera mode.
 */
export function phaseHasCameraMode(phase: CasePhase): boolean {
  try {
    const mode = getCameraModeForPhase(phase);
    return !!mode && !!BASE_CAMERA_CONFIGS[mode];
  } catch {
    return false;
  }
}
