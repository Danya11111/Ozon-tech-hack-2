/**
 * Stage 0 — premium 3D technical feasibility prototype.
 * Pure query-string parsing + device classification. No React, no Three.js.
 *
 * Prototype mode is strictly opt-in via `?stage0=1` (or `?prototype=cinematic`).
 * The default route `/` keeps its previous behaviour except for the fixed
 * mobile fallback (handled in MainPage).
 */

import type { QualityMode } from './qualityMode';
import type { CasePhase } from './continuousPlayback';
import type { Category } from './types';

export interface Stage0Config {
  /** Prototype mode master switch. */
  enabled: boolean;
  /** Enable real shadow maps (key light castShadow, PCFSoft 1024). */
  shadows: boolean;
  /** Enable the existing CinematicCameraController. */
  camera: boolean;
  /** Dark scene background (INDUSTRIAL_PALETTE.backgroundDark). */
  darkBackground: boolean;
  /** ACESFilmic tone mapping + sRGB output. */
  toneMapping: boolean;
  /** Lazy post-processing spike (Bloom + Vignette + Noise). */
  post: boolean;
  /** Adaptive quality via adaptQuality() wired to measured FPS. */
  adaptive: boolean;
  /** Fill light intensity multiplier gate. */
  fill: boolean;
  /** Rim (back) light gate. */
  rim: boolean;
  /** Show the compact technical HUD (hidden with hud=0). */
  hud: boolean;
  /** Manual shot override for the cinematic camera (null = phase-driven). */
  shot: Stage0Shot | null;
  /** Ambient light intensity in prototype mode. */
  ambient: number;
  /** Explicit quality preset override (null = auto device classification). */
  quality: QualityMode | null;
  /** Show PerfCollector + PerfOverlay. */
  perf: boolean;
}

export type Stage0Shot = 'overview' | 'inspection' | 'route-b' | 'route-c' | 'route-d' | 'safety';

const SHOTS: readonly Stage0Shot[] = ['overview', 'inspection', 'route-b', 'route-c', 'route-d', 'safety'];

function flag(params: URLSearchParams, name: string, fallback: boolean): boolean {
  const raw = params.get(name);
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true' || raw === 'on';
}

/**
 * Parse Stage 0 configuration from a query string.
 * Defaults (when stage0=1 without extra params): shadows on, camera on,
 * dark background on, tone mapping on, post OFF, adaptive OFF, fill/rim on,
 * HUD on, no manual shot, ambient 0.12.
 */
export function parseStage0Config(search: string): Stage0Config {
  const params = new URLSearchParams(search);
  const enabled =
    params.get('stage0') === '1' || params.get('prototype') === 'cinematic';

  const shotRaw = params.get('shot');
  const shot = SHOTS.includes(shotRaw as Stage0Shot) ? (shotRaw as Stage0Shot) : null;

  const ambientRaw = Number(params.get('ambient'));

  const qualityRaw = params.get('quality');
  const quality: QualityMode | null =
    qualityRaw === 'low' || qualityRaw === 'medium' || qualityRaw === 'high' || qualityRaw === 'demo'
      ? qualityRaw
      : null;

  return {
    enabled,
    shadows: flag(params, 'shadows', true),
    camera: flag(params, 'camera', true),
    darkBackground: params.get('bg') !== 'light',
    toneMapping: flag(params, 'tone', true),
    post: flag(params, 'post', false),
    adaptive: flag(params, 'adaptive', false),
    fill: flag(params, 'fill', true),
    rim: flag(params, 'rim', true),
    hud: flag(params, 'hud', true),
    shot,
    ambient: Number.isFinite(ambientRaw) && ambientRaw > 0 && ambientRaw <= 1 ? ambientRaw : 0.12,
    quality,
    perf: flag(params, 'perf', false),
  };
}

/**
 * Map a manual shot id to an equivalent (phase, category) pair understood by
 * the existing getCameraConfig() — zero changes to cinematicCamera.ts.
 */
export function shotToPhaseCategory(shot: Stage0Shot): { phase: CasePhase; category: Category | null } {
  switch (shot) {
    case 'overview':
      return { phase: 'move_to_detection', category: null }; // -> 'overview' mode
    case 'inspection':
      return { phase: 'detection', category: null }; // -> 'inspectionTop'
    case 'route-b':
      return { phase: 'routing', category: 'B' };
    case 'route-c':
      return { phase: 'routing', category: 'C' };
    case 'route-d':
      return { phase: 'routing', category: 'D' };
    case 'safety':
      return { phase: 'fault_hold', category: null }; // -> 'routingWide'
  }
}

export interface DeviceSignals {
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  devicePixelRatio: number;
  viewportWidth: number;
  renderer: string;
  softwareRenderer: boolean;
  userAgent: string;
}

/** Collect best-effort device signals for quality selection (no fingerprinting). */
export function collectDeviceSignals(renderer = 'unknown'): DeviceSignals {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      hardwareConcurrency: null,
      deviceMemoryGb: null,
      devicePixelRatio: 1,
      viewportWidth: 1200,
      renderer,
      softwareRenderer: false,
      userAgent: '',
    };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    renderer,
    softwareRenderer: /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i.test(renderer),
    userAgent: navigator.userAgent,
  };
}

/**
 * Pick the initial quality tier for prototype mode using device signals
 * instead of viewport width alone. Falls back to width when signals missing.
 */
export function choosePrototypeQuality(width: number, signals: DeviceSignals): QualityMode {
  if (signals.softwareRenderer) return 'low';
  const cores = signals.hardwareConcurrency ?? 4;
  const memory = signals.deviceMemoryGb ?? 4;

  const weak = cores <= 4 || memory <= 4;
  const strong = cores >= 8 && memory >= 8;

  if (width < 768) return 'low';
  if (weak) return width < 1100 ? 'low' : 'medium';
  if (width < 1100) return 'medium';
  return strong ? 'demo' : 'medium';
}

/** Log a single adaptive-quality transition (reason tracing for Stage 0). */
export function describeAdaptiveSwitch(from: QualityMode, to: QualityMode, fps: number): string {
  return `[stage0] adaptive quality ${from} -> ${to} (avg fps ${fps.toFixed(1)})`;
}
