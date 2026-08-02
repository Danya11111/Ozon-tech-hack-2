/**
 * Stage 2B §10–12 — continuous measurement zone (no stop under the camera).
 *
 * The Intel RealSense D435i optical center is mounted above the belt at
 * ZONES.CAMERA.x; its ~86° horizontal FOV at the belt plane defines the scan
 * window. Items cross it at constant belt speed — measurement progress is
 * POSITION-based (never time-based), so it is correct at any belt speed,
 * playback speed, pause and replay:
 *
 *   scanProgress = clamp((itemX - scanStartX) / (scanEndX - scanStartX))
 *
 * Classification must be READY before the classification deadline position,
 * well ahead of the mechanism engagement point (gate).
 */

import { ZONES } from './physicalLayout';

/** D435i frustum footprint on the belt: optical center 1.35 m (0.65 m above
 *  belt top 0.7 m); the bar is mounted ACROSS the belt, so the along-belt
 *  extent uses the 58° vertical FOV: 2·0.65·tan(29°) ≈ 0.72 m window. */
export const SCAN_START_X = ZONES.CAMERA.x - 0.36;
export const SCAN_END_X = ZONES.CAMERA.x + 0.36;

/** Classification must be complete by this belt position (gate at ZONES.GATE.x = 1.5 — 1.0 m margin). */
export const CLASSIFICATION_DEADLINE_X = 0.5;

/** Mechanism engagement point (paddle engages the item at the gate). */
export const MECHANISM_CONTACT_X = ZONES.GATE.x;

export type ScanWindow = 'approaching' | 'scanning' | 'complete';

/** Normalized scan progress from item belt position (0 = entering frustum, 1 = leaving). */
export function getScanProgress(itemX: number): number {
  const t = (itemX - SCAN_START_X) / (SCAN_END_X - SCAN_START_X);
  return Math.max(0, Math.min(1, t));
}

export function getScanWindow(itemX: number): ScanWindow {
  if (itemX < SCAN_START_X) return 'approaching';
  if (itemX <= SCAN_END_X) return 'scanning';
  return 'complete';
}
