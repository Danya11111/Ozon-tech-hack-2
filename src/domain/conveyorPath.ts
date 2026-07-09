/**
 * Conveyor Path — calculates item position based on phase and progress.
 * Uses real-world scale: 1 unit = 1 meter, conveyor speed = 1 m/s.
 */

import type { Category } from './types';
import type { CasePhase, ContinuousPlaybackState } from './continuousPlayback';
import { getPhaseProgress, getCaseProgress } from './continuousPlayback';

/** Key positions along the conveyor in meters (3D scene coordinates). */
export const CONVEYOR_POSITIONS = {
  /** Zone A - item spawn point */
  spawnX: -4.2,
  /** Camera/CV detection zone */
  cameraX: -1.2,
  /** Laser measurement zone */
  laserX: -0.2,
  /** Accumulator/gate position */
  gateX: 1.6,
  /** Zone B exit (main sorter) */
  zoneBX: 3.8,
  /** Zone C position (negative Z) */
  zoneCZ: 2.4,
  /** Zone D position (positive Z) */
  zoneDZ: -2.4,
  /** Belt height */
  beltY: 0.35,
  /** Item center height offset */
  itemOffsetY: 0.15,
} as const;

/** Total conveyor length from A to gate in meters. */
export const CONVEYOR_LENGTH = CONVEYOR_POSITIONS.gateX - CONVEYOR_POSITIONS.spawnX;

/** Conveyor speed in m/s. */
export const CONVEYOR_SPEED_MPS = 1.0;

export interface ItemPosition3D {
  x: number;
  y: number;
  z: number;
}

/** Calculate item X position based on phase and progress. */
function getItemXForPhase(phase: CasePhase, phaseProgress: number): number {
  const { spawnX, cameraX, laserX, gateX, zoneBX } = CONVEYOR_POSITIONS;
  
  switch (phase) {
    case 'spawn':
      // Item appears at spawn point
      return spawnX;
    
    case 'move_to_detection':
      // Move from spawn to camera
      return spawnX + (cameraX - spawnX) * phaseProgress;
    
    case 'detection':
      // At camera position
      return cameraX;
    
    case 'measurement':
      // Move from camera to laser
      return cameraX + (laserX - cameraX) * phaseProgress;
    
    case 'classification':
      // Move from laser toward gate
      return laserX + (gateX - laserX) * 0.5 * phaseProgress;
    
    case 'command_sent':
      // Continue toward gate
      const midPoint = laserX + (gateX - laserX) * 0.5;
      return midPoint + (gateX - midPoint) * phaseProgress;
    
    case 'routing':
      // At gate, preparing to route
      return gateX;
    
    case 'exit':
      // Moving toward exit zone (B moves forward, C/D stays at gate X for lateral movement)
      return gateX + (zoneBX - gateX) * phaseProgress * 0.5;
    
    case 'clear_gap':
      // Clear the area
      return gateX + (zoneBX - gateX) * 0.5 + (zoneBX - gateX) * 0.5 * phaseProgress;
    
    default:
      return gateX;
  }
}

/** Calculate item Z position for routing to C or D. */
function getItemZForPhase(phase: CasePhase, phaseProgress: number, category: Category | null): number {
  if (!category || category === 'B') return 0;
  
  const { zoneCZ, zoneDZ } = CONVEYOR_POSITIONS;
  
  if (phase === 'routing') {
    // Start lateral movement
    const targetZ = category === 'C' ? zoneCZ : zoneDZ;
    return targetZ * phaseProgress;
  }
  
  if (phase === 'exit' || phase === 'clear_gap') {
    // At target Z position
    return category === 'C' ? zoneCZ : zoneDZ;
  }
  
  return 0;
}

/** Get item 3D position from playback state. */
export function getItemPosition(state: ContinuousPlaybackState): ItemPosition3D {
  const phaseProgress = getPhaseProgress(state);
  const { beltY, itemOffsetY } = CONVEYOR_POSITIONS;
  
  const x = getItemXForPhase(state.currentPhase, phaseProgress);
  const z = getItemZForPhase(state.currentPhase, phaseProgress, state.targetCategory);
  const y = beltY + itemOffsetY;
  
  return { x, y, z };
}

/** Get item visibility based on phase. */
export function isItemVisible(state: ContinuousPlaybackState): boolean {
  // Item is visible from spawn until clear_gap starts
  return state.currentPhase !== 'clear_gap' || getPhaseProgress(state) < 0.5;
}

/** Get detection zone highlight status. */
export function isDetectionZoneActive(state: ContinuousPlaybackState): boolean {
  return state.currentPhase === 'detection' || state.currentPhase === 'measurement';
}

/** Get active route based on phase and category. */
export function getActiveRoute(state: ContinuousPlaybackState): Category | null {
  if (state.currentPhase === 'routing' || state.currentPhase === 'exit') {
    return state.targetCategory;
  }
  return null;
}

/** Get conveyor belt animation speed factor (0 when stopped, 1 when running). */
export function getConveyorSpeedFactor(state: ContinuousPlaybackState): number {
  if (state.status !== 'running') return 0;
  
  // Conveyor slows during detection/classification
  if (state.currentPhase === 'detection' || state.currentPhase === 'classification') {
    return 0.3;
  }
  
  // Normal speed during movement phases
  return 1.0;
}

/** Calculate distance traveled in meters from elapsed time. */
export function getDistanceTraveled(elapsedMs: number): number {
  return (elapsedMs / 1000) * CONVEYOR_SPEED_MPS;
}

/** Calculate time in ms to travel a distance at conveyor speed. */
export function getTimeForDistance(distanceM: number): number {
  return (distanceM / CONVEYOR_SPEED_MPS) * 1000;
}
