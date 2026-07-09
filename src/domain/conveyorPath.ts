/**
 * Conveyor Path — calculates item position based on phase and progress.
 * Uses real-world scale: 1 unit = 1 meter, conveyor speed = 1 m/s.
 * 
 * Physical parameters sourced from physicalLayout.ts
 */

import type { Category } from './types';
import type { CasePhase, ContinuousPlaybackState } from './continuousPlayback';
import { getPhaseProgress } from './continuousPlayback';
import {
  CONVEYOR_POSITIONS,
  BELT_TOP_Y,
  CONVEYOR_SPEED_MPS,
  getItemYOnBelt,
} from './physicalLayout';

// Re-export for backwards compatibility
export { CONVEYOR_POSITIONS, CONVEYOR_SPEED_MPS };

/** Total conveyor length from A to gate in meters. */
export const CONVEYOR_LENGTH = CONVEYOR_POSITIONS.gateX - CONVEYOR_POSITIONS.spawnX;

export interface ItemPosition3D {
  x: number;
  y: number;
  z: number;
}

/** Calculate item X position based on phase and progress. */
function getItemXForPhase(phase: CasePhase, phaseProgress: number, category: Category | null): number {
  const { spawnX, cameraX, laserX, gateX, zoneBX } = CONVEYOR_POSITIONS;
  
  switch (phase) {
    case 'spawn':
      return spawnX;
    
    case 'move_to_detection':
      return spawnX + (cameraX - spawnX) * phaseProgress;
    
    case 'detection':
      return cameraX;
    
    case 'measurement':
      return cameraX + (laserX - cameraX) * phaseProgress;
    
    case 'classification':
      return laserX + (gateX - laserX) * 0.5 * phaseProgress;
    
    case 'command_sent':
      const midPoint = laserX + (gateX - laserX) * 0.5;
      return midPoint + (gateX - midPoint) * phaseProgress;
    
    case 'routing':
      if (category === 'B') {
        return gateX + (zoneBX - gateX) * phaseProgress;
      }
      return gateX;
    
    case 'exit':
      return category === 'B' ? zoneBX : gateX;
    
    case 'clear_gap':
      return category === 'B' ? zoneBX : gateX;
    
    default:
      return gateX;
  }
}

/** Calculate item Z position for routing to C or D. */
function getItemZForPhase(phase: CasePhase, phaseProgress: number, category: Category | null): number {
  if (!category || category === 'B') return 0;
  
  const { zoneCZ, zoneDZ } = CONVEYOR_POSITIONS;
  
  if (phase === 'routing') {
    const targetZ = category === 'C' ? zoneCZ : zoneDZ;
    return targetZ * phaseProgress;
  }
  
  if (phase === 'exit' || phase === 'clear_gap') {
    return category === 'C' ? zoneCZ : zoneDZ;
  }
  
  return 0;
}

/**
 * Get item 3D position from playback state.
 * Item is positioned ON the belt surface (not floating above).
 */
export function getItemPosition(state: ContinuousPlaybackState, itemVisualHeight: number = 0.15): ItemPosition3D {
  const phaseProgress = getPhaseProgress(state);
  
  const x = getItemXForPhase(state.currentPhase, phaseProgress, state.targetCategory);
  const z = getItemZForPhase(state.currentPhase, phaseProgress, state.targetCategory);
  // Item sits ON the belt: belt top + half item height
  const y = getItemYOnBelt(itemVisualHeight);
  
  return { x, y, z };
}

/** Get item visibility based on phase. */
export function isItemVisible(state: ContinuousPlaybackState): boolean {
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
  
  const movingPhases: CasePhase[] = [
    'move_to_detection',
    'measurement',
    'classification',
    'command_sent',
    'routing',
  ];

  return movingPhases.includes(state.currentPhase) ? 1.0 : 0;
}

/** Calculate distance traveled in meters from elapsed time. */
export function getDistanceTraveled(elapsedMs: number): number {
  return (elapsedMs / 1000) * CONVEYOR_SPEED_MPS;
}

/** Calculate time in ms to travel a distance at conveyor speed. */
export function getTimeForDistance(distanceM: number): number {
  return (distanceM / CONVEYOR_SPEED_MPS) * 1000;
}
