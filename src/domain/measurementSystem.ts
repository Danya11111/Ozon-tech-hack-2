/**
 * Measurement System — engineering logic for item measurement.
 *
 * Measurement architecture:
 * 1. Stepper motor: measures length along conveyor axis (step counting)
 * 2. Laser rangefinder: measures height from above
 * 3. Stereo camera: measures width and determines shape/roundness
 * 4. PLC controller: synchronizes and makes classification decision via classifyItem
 */

import type { ContinuousPlaybackState, CasePhase } from './continuousPlayback';
import type { Category } from './types';
import { classifyItem, DIMENSION_LIMITS } from './classifier';
import { resolveItem } from '../data/resolveItem';
import {
  MM_PER_STEP,
  LASER_HEIGHT_M,
  BELT_TOP_Y,
} from './physicalLayout';

export type MeasurementStage =
  | 'idle'
  | 'leading_edge_detected'
  | 'step_counting'
  | 'laser_height'
  | 'stereo_width_shape'
  | 'decision_ready'
  | 'command_sent';

export interface MeasurementData {
  stage: MeasurementStage;
  stepCount: number;
  mmPerStep: number;
  measuredLengthMm: number;
  pulseActive: boolean;
  laserDistanceMm: number;
  laserMountHeightMm: number;
  measuredHeightMm: number;
  laserBeamActive: boolean;
  measuredWidthMm: number;
  roundnessK: number;
  stereoActive: boolean;
  pointCloudActive: boolean;
  confidence: number;
  dimensionsPass: boolean;
  shapeResult: 'box' | 'round' | 'irregular';
  finalCategory: Category | null;
  command: string;
  cPriorityApplied: boolean;
  isLowConfidence: boolean;
  /** Live classifier reason (proof of algorithm). */
  classificationReason: string | null;
  classificationLabel: string | null;
  itemTitle: string;
  itemDimensions: { width: number; depth: number; height: number };
}

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
    case 'fault_hold':
    case 'emergency_hold':
    case 'recover':
      return 'command_sent';
    case 'clear_gap':
      return 'idle';
    default:
      return 'idle';
  }
}

function getShapeResult(roundnessK: number): 'box' | 'round' | 'irregular' {
  if (roundnessK >= DIMENSION_LIMITS.roundnessThreshold) return 'round';
  if (roundnessK >= 0.3) return 'box';
  return 'irregular';
}

export function getMeasurementData(playback: ContinuousPlaybackState): MeasurementData {
  const currentCase = playback.currentCase;
  const phase = playback.currentPhase;
  const stage = getStageFromPhase(phase);

  const itemData = resolveItem(currentCase.itemId);
  const dims = itemData.dimensionsMm;

  const lengthMm = dims.depth;
  const stepCount = Math.round(lengthMm / MM_PER_STEP);

  const laserMountHeightMm = LASER_HEIGHT_M * 1000;
  const itemTopHeightMm = BELT_TOP_Y * 1000 + dims.height;
  const laserDistanceMm = laserMountHeightMm - itemTopHeightMm;

  const measuredLengthMm = stepCount * MM_PER_STEP;
  const measuredHeightMm = laserMountHeightMm - laserDistanceMm;
  const measuredWidthMm = dims.width;
  const roundnessK = itemData.roundness;

  const classification = classifyItem(itemData);
  const dimensionsPass = classification.dimensionsPass;
  const shapeResult = getShapeResult(roundnessK);
  const confidence = itemData.confidence ?? 0.95;
  const isLowConfidence = confidence < 0.65;

  const deciding =
    phase !== 'spawn' &&
    phase !== 'move_to_detection' &&
    phase !== 'clear_gap';

  let finalCategory: Category | null = null;
  let cPriorityApplied = false;
  let classificationReason: string | null = null;
  let classificationLabel: string | null = null;

  if (deciding) {
    // Prefer live result already computed on playback; fall back to classifyItem.
    finalCategory = playback.classification?.category ?? classification.category;
    classificationReason = playback.classification?.reason ?? classification.reason;
    classificationLabel = playback.classification?.label ?? classification.label;
    cPriorityApplied =
      finalCategory === 'C' && roundnessK >= DIMENSION_LIMITS.roundnessThreshold;
  }

  const command =
    phase === 'fault_hold'
      ? 'FAULT'
      : phase === 'emergency_hold'
        ? 'EMERGENCY_STOP'
        : finalCategory
          ? `ROUTE_TO_${finalCategory}`
          : 'STANDBY';

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
    classificationReason,
    classificationLabel,
    itemTitle: currentCase.title,
    itemDimensions: dims,
  };
}

export function getStageLabel(stage: MeasurementStage): string {
  switch (stage) {
    case 'idle':
      return 'Standby';
    case 'leading_edge_detected':
      return 'Edge Detected';
    case 'step_counting':
      return 'Counting Steps';
    case 'laser_height':
      return 'Laser Height';
    case 'stereo_width_shape':
      return 'Stereo Analysis';
    case 'decision_ready':
      return 'Decision Ready';
    case 'command_sent':
      return 'Command Sent';
    default:
      return 'Unknown';
  }
}

export function shouldShowMeasurement(phase: CasePhase): boolean {
  return [
    'detection',
    'measurement',
    'classification',
    'command_sent',
    'routing',
    'fault_hold',
    'emergency_hold',
  ].includes(phase);
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
