/**
 * Measurement System — engineering logic for item measurement.
 * 
 * Measurement architecture:
 * 1. Stepper motor: measures length along conveyor axis (step counting)
 * 2. Laser rangefinder: measures height from above
 * 3. Stereo camera: measures width and determines shape/roundness
 * 4. PLC controller: synchronizes and makes classification decision
 */

import type { ContinuousPlaybackState, CasePhase } from './continuousPlayback';
import type { Category } from './types';
import { ITEMS } from '../data/items';
import {
  MM_PER_STEP,
  LASER_HEIGHT_M,
  BELT_TOP_Y,
  CONVEYOR_SPEED_MPS,
} from './physicalLayout';

// =========================================================
// Types
// =========================================================

export type MeasurementStage = 
  | 'idle'
  | 'leading_edge_detected'
  | 'step_counting'
  | 'laser_height'
  | 'stereo_width_shape'
  | 'decision_ready'
  | 'command_sent';

export interface MeasurementData {
  /** Current measurement stage */
  stage: MeasurementStage;
  
  /** Stepper motor data */
  stepCount: number;
  mmPerStep: number;
  measuredLengthMm: number;
  pulseActive: boolean;
  
  /** Laser rangefinder data */
  laserDistanceMm: number;
  laserMountHeightMm: number;
  measuredHeightMm: number;
  laserBeamActive: boolean;
  
  /** Stereo camera data */
  measuredWidthMm: number;
  roundnessK: number;
  stereoActive: boolean;
  pointCloudActive: boolean;
  
  /** Classification */
  confidence: number;
  dimensionsPass: boolean;
  shapeResult: 'box' | 'round' | 'irregular';
  finalCategory: Category | null;
  command: string;
  cPriorityApplied: boolean;
  isLowConfidence: boolean;
  
  /** Item info */
  itemTitle: string;
  itemDimensions: { width: number; depth: number; height: number };
}

// =========================================================
// Dimension limits (OZON Track 3 spec)
// =========================================================
const MAX_DIMENSION_MM = {
  width: 450,
  depth: 320,
  height: 320,
};

// =========================================================
// Stage mapping from playback phase
// =========================================================
function getStageFromPhase(phase: CasePhase): MeasurementStage {
  switch (phase) {
    case 'spawn':
    case 'move_to_detection':
      return 'idle';
    case 'detection':
      return 'leading_edge_detected';
    case 'measurement':
      return 'step_counting';
    case 'classification':
      return 'decision_ready';
    case 'command_sent':
    case 'routing':
    case 'exit':
      return 'command_sent';
    case 'clear_gap':
      return 'idle';
    default:
      return 'idle';
  }
}

// =========================================================
// Check dimension compliance
// =========================================================
function checkDimensionsPass(dims: { width: number; depth: number; height: number }): boolean {
  return (
    dims.width <= MAX_DIMENSION_MM.width &&
    dims.depth <= MAX_DIMENSION_MM.depth &&
    dims.height <= MAX_DIMENSION_MM.height
  );
}

// =========================================================
// Determine shape from roundness
// =========================================================
function getShapeResult(roundnessK: number): 'box' | 'round' | 'irregular' {
  if (roundnessK >= 0.7) return 'round';
  if (roundnessK >= 0.3) return 'box';
  return 'irregular';
}

// =========================================================
// Main measurement data getter
// =========================================================
export function getMeasurementData(playback: ContinuousPlaybackState): MeasurementData {
  const currentCase = playback.currentCase;
  const phase = playback.currentPhase;
  const stage = getStageFromPhase(phase);
  
  // Get item data
  const itemId = currentCase.itemId.replace('-LC', '');
  const itemData = ITEMS.find(i => i.id === itemId) ?? ITEMS[0];
  const dims = itemData.dimensionsMm;
  
  // Calculate step count from item length (depth = length along conveyor)
  const lengthMm = dims.depth;
  const stepCount = Math.round(lengthMm / MM_PER_STEP);
  
  // Laser measurement: distance from laser to top of item
  const laserMountHeightMm = LASER_HEIGHT_M * 1000;
  const itemTopHeightMm = BELT_TOP_Y * 1000 + dims.height;
  const laserDistanceMm = laserMountHeightMm - itemTopHeightMm;
  
  // Derived measurements
  const measuredLengthMm = stepCount * MM_PER_STEP;
  const measuredHeightMm = laserMountHeightMm - laserDistanceMm;
  const measuredWidthMm = dims.width;
  const roundnessK = itemData.roundness;
  
  // Classification
  const dimensionsPass = checkDimensionsPass(dims);
  const shapeResult = getShapeResult(roundnessK);
  const confidence = itemData.confidence ?? 0.95;
  const isLowConfidence = confidence < 0.8;
  
  // Determine category
  let finalCategory: Category | null = null;
  let cPriorityApplied = false;
  
  if (phase !== 'spawn' && phase !== 'move_to_detection') {
    if (!dimensionsPass) {
      // Dimensions fail → C (overrides roundness)
      finalCategory = 'C';
      if (roundnessK >= 0.7) {
        cPriorityApplied = true;
      }
    } else if (roundnessK >= 0.7) {
      // Round shape → D
      finalCategory = 'D';
    } else {
      // Normal → B
      finalCategory = 'B';
    }
  }
  
  // Override with expected category if available (for consistent demo)
  if (currentCase.expectedCategory && phase !== 'spawn' && phase !== 'move_to_detection') {
    finalCategory = currentCase.expectedCategory;
    // Check if C-priority case
    if (finalCategory === 'C' && roundnessK >= 0.7) {
      cPriorityApplied = true;
    }
  }
  
  // Command
  const command = finalCategory ? `ROUTE_TO_${finalCategory}` : 'STANDBY';
  
  // Active states for visualization
  const isActivePhase = ['detection', 'measurement', 'classification'].includes(phase);
  const pulseActive = stage === 'step_counting' || stage === 'leading_edge_detected';
  const laserBeamActive = isActivePhase;
  const stereoActive = isActivePhase;
  const pointCloudActive = phase === 'measurement' || phase === 'classification';
  
  return {
    stage,
    stepCount,
    mmPerStep: MM_PER_STEP,
    measuredLengthMm: Math.round(measuredLengthMm),
    pulseActive,
    laserDistanceMm: Math.round(laserDistanceMm),
    laserMountHeightMm: Math.round(laserMountHeightMm),
    measuredHeightMm: Math.round(measuredHeightMm),
    laserBeamActive,
    measuredWidthMm,
    roundnessK,
    stereoActive,
    pointCloudActive,
    confidence,
    dimensionsPass,
    shapeResult,
    finalCategory,
    command,
    cPriorityApplied,
    isLowConfidence,
    itemTitle: currentCase.title,
    itemDimensions: dims,
  };
}

// =========================================================
// Stage labels for UI
// =========================================================
export function getStageLabel(stage: MeasurementStage): string {
  switch (stage) {
    case 'idle': return 'Standby';
    case 'leading_edge_detected': return 'Edge Detected';
    case 'step_counting': return 'Counting Steps';
    case 'laser_height': return 'Laser Height';
    case 'stereo_width_shape': return 'Stereo Analysis';
    case 'decision_ready': return 'Decision Ready';
    case 'command_sent': return 'Command Sent';
    default: return 'Unknown';
  }
}

// =========================================================
// Check if measurement visualization should be shown
// =========================================================
export function shouldShowMeasurement(phase: CasePhase): boolean {
  return ['detection', 'measurement', 'classification', 'command_sent', 'routing'].includes(phase);
}

export function shouldShowLaserBeam(phase: CasePhase): boolean {
  return ['detection', 'measurement'].includes(phase);
}

export function shouldShowStepperPulse(phase: CasePhase): boolean {
  return ['detection', 'measurement'].includes(phase);
}

export function shouldShowPointCloud(phase: CasePhase): boolean {
  return ['measurement', 'classification'].includes(phase);
}

export function shouldShowActuator(phase: CasePhase): boolean {
  return ['routing', 'exit'].includes(phase);
}
