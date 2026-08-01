/**
 * Inspection View Model — adapts playback state to CV inspection overlay data.
 * Measurement values are fixture-driven (mock perception contract).
 */

import type { ContinuousPlaybackState, CasePhase } from './continuousPlayback';
import type { Category } from './types';
import { ITEMS } from '../data/items';
import { dimensionsPassOfficial, isCircularCrossSection } from './classifier';

export type DetectedShape = 'box' | 'cylinder' | 'round' | 'irregular' | 'unknown';

export interface InspectionData {
  visible: boolean;
  phase: CasePhase;
  phaseLabel: string;
  itemTitle: string;
  shape: DetectedShape;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  roundness: number;
  confidence: number;
  isLowConfidence: boolean;
  category: Category | null;
  command: string;
  warning: string | null;
  dimensionsFail: boolean;
  roundnessFail: boolean;
  cPriority: boolean;
}

const PHASE_LABELS: Record<CasePhase, string> = {
  spawn: 'Waiting...',
  move_to_detection: 'Approaching camera',
  detection: 'Detecting object',
  measurement: 'Measuring dimensions',
  classification: 'Classifying',
  command_sent: 'Command sent',
  routing: 'Routing to zone',
  exit: 'Exiting',
  clear_gap: 'Clear',
  fault_hold: 'FAULT / Jam',
  emergency_hold: 'EMERGENCY STOP',
  recover: 'Recovering',
};

const VISIBLE_PHASES: CasePhase[] = [
  'detection',
  'measurement',
  'classification',
  'command_sent',
  'routing',
  'fault_hold',
  'emergency_hold',
];

function normalizeShape(shape: string, roundness: number): DetectedShape {
  const lower = shape.toLowerCase();
  if (lower.includes('cylinder') || lower.includes('bottle')) return 'cylinder';
  if (lower.includes('round') || lower.includes('plate') || isCircularCrossSection(roundness)) return 'round';
  if (lower.includes('box') || lower.includes('rectangular')) return 'box';
  if (lower.includes('irregular') || lower.includes('soft')) return 'irregular';
  return 'unknown';
}

export function getInspectionData(playback: ContinuousPlaybackState): InspectionData {
  const currentCase = playback.currentCase;
  const phase = playback.currentPhase;

  const itemId = currentCase.itemId.replace('-LC', '');
  const itemData = ITEMS.find((i) => i.id === itemId) ?? ITEMS[0];

  const isLowConfidence = currentCase.id === 'low_confidence';
  const confidence = isLowConfidence ? 0.58 : itemData.confidence;

  const dimensions = itemData.dimensionsMm;
  const roundness = itemData.roundness;
  const shape = normalizeShape(itemData.shape, roundness);

  const dimensionsFail = !dimensionsPassOfficial(dimensions);
  const roundnessFail = isCircularCrossSection(roundness);
  const cPriority = currentCase.id === 'c_priority';

  const category = playback.targetCategory;
  const command = playback.command;

  return {
    visible: VISIBLE_PHASES.includes(phase),
    phase,
    phaseLabel: PHASE_LABELS[phase],
    itemTitle: currentCase.title,
    shape,
    dimensions,
    roundness,
    confidence,
    isLowConfidence,
    category,
    command,
    warning: currentCase.warning ?? null,
    dimensionsFail,
    roundnessFail,
    cPriority,
  };
}

export function shouldShowBoundingBox(phase: CasePhase): boolean {
  return phase === 'measurement' || phase === 'classification';
}

export function shouldShowScanEffect(phase: CasePhase): boolean {
  return phase === 'detection';
}

export function shouldShowShapeOutline(phase: CasePhase): boolean {
  return phase === 'classification' || phase === 'command_sent';
}

export function shouldHighlightCamera(phase: CasePhase): boolean {
  return phase === 'detection' || phase === 'measurement';
}
