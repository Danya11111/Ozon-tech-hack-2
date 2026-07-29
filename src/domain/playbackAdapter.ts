/**
 * playbackAdapter — pure projection of ContinuousPlaybackState (main page
 * engine) onto SimulationState (shape consumed by the SVG SorterScene).
 *
 * Used ONLY for the 2D fallback path (no WebGL / lightweight mobile mode /
 * context loss). Classification stays live: the same classifyItem() rule
 * engine produces the category shown in the fallback.
 */

import type { ContinuousPlaybackState, CasePhase } from './continuousPlayback';
import type {
  MachineState,
  SimulationState,
  SimulatedItem,
  Scenario,
  SystemStatus,
  Metrics,
  Category,
} from './types';
import { classifyItem } from './classifier';
import { resolveItem } from '../data/resolveItem';
import { SCENARIOS } from '../data/scenarios';

const DEFAULT_SCENARIO: Scenario = SCENARIOS[0];

function phaseToMachineState(phase: CasePhase, category: Category | null): MachineState {
  switch (phase) {
    case 'spawn':
      return 'IDLE';
    case 'move_to_detection':
      return 'MOVING_TO_CAMERA';
    case 'detection':
    case 'measurement':
      return 'DETECTING';
    case 'classification':
      return 'MOVING_TO_GATE';
    case 'command_sent':
      return 'WAITING_AT_GATE';
    case 'routing':
      return category === 'C' ? 'ROUTE_TO_C' : category === 'D' ? 'ROUTE_TO_D' : 'ROUTE_TO_B';
    case 'exit':
    case 'clear_gap':
      return category === 'C' ? 'ROUTE_TO_C' : category === 'D' ? 'ROUTE_TO_D' : 'ROUTE_TO_B';
    case 'fault_hold':
      return 'FAULT';
    case 'emergency_hold':
      return 'EMERGENCY_STOP';
    case 'recover':
      return 'RETURN_HOME';
    default:
      return 'IDLE';
  }
}

function sensorActive(phase: CasePhase, kind: 'camera' | 'laser' | 'ultrasound'): boolean {
  switch (kind) {
    case 'camera':
      return phase === 'detection' || phase === 'measurement' || phase === 'classification';
    case 'laser':
      return phase === 'measurement';
    case 'ultrasound':
      return phase === 'classification' || phase === 'command_sent' || phase === 'routing';
  }
}

function emptyMetrics(): Metrics {
  return {
    processedCount: 0,
    successCount: 0,
    errorCount: 0,
    avgCycleTimeMs: 0,
    throughputItemsPerMin: 0,
    cvLatencyMs: 0,
    actuatorLatencyMs: 0,
    queueLength: 0,
    queueDelayMs: 0,
    conveyorSpeedMps: 1,
    pidTargetSpeedMps: 1,
    pidActualSpeedMps: 1,
  };
}

/**
 * Project continuous playback onto the SVG fallback scene state.
 * During 'recover' the item is hidden (line is being cleared).
 * During 'exit'/'clear_gap' the item is shown settled at its receiver
 * (elapsed pinned past the SorterScene route segment duration).
 */
export function playbackToSimulation(playback: ContinuousPlaybackState): SimulationState {
  const item = resolveItem(playback.currentCase.itemId);
  const classification = playback.classification ?? classifyItem(item);
  const category = classification.category;
  const phase = playback.currentPhase;
  const machineState = phaseToMachineState(phase, category);

  const routingLike = phase === 'routing' || phase === 'exit' || phase === 'clear_gap';
  const settled = phase === 'exit' || phase === 'clear_gap';
  const hideItem = phase === 'recover' || playback.status === 'finished';
  // SorterScene caps route progress at 1200 ms — pin past it once settled.
  const elapsedInStateMs = settled ? 1300 : playback.phaseElapsedMs;

  const currentItem: SimulatedItem | undefined = hideItem
    ? undefined
    : {
        item,
        startedAtMs: playback.totalElapsedMs - playback.caseElapsedMs,
        classification,
        cycleTimeMs: playback.caseElapsedMs,
      };

  const systemStatus: SystemStatus =
    machineState === 'FAULT'
      ? 'FAULT'
      : machineState === 'EMERGENCY_STOP'
        ? 'EMERGENCY_STOP'
        : playback.status === 'paused'
          ? 'PAUSED'
          : 'RUNNING';

  return {
    scenario: DEFAULT_SCENARIO,
    systemStatus,
    running: playback.status === 'running',
    machineState,
    itemIndex: playback.currentCaseIndex,
    elapsedInStateMs,
    simTimeMs: playback.totalElapsedMs,
    currentItem,
    metrics: emptyMetrics(),
    sensors: {
      camera: {
        kind: 'camera',
        label: 'Camera',
        active: sensorActive(phase, 'camera'),
        lastValue: '',
        latencyMs: 0,
        lastEventTimestampMs: playback.totalElapsedMs,
        cvLatencyMs: 0,
      },
      laser: {
        kind: 'laser',
        label: 'Laser',
        active: sensorActive(phase, 'laser'),
        lastValue: '',
        latencyMs: 0,
        lastEventTimestampMs: playback.totalElapsedMs,
      },
      ultrasound: {
        kind: 'ultrasound',
        label: 'Ultrasound',
        active: sensorActive(phase, 'ultrasound'),
        lastValue: '',
        latencyMs: 0,
        lastEventTimestampMs: playback.totalElapsedMs,
        objectAtGate: phase === 'command_sent',
      },
    },
    gate: { open: routingLike },
    actuators: {
      pusherC: routingLike && category === 'C' ? 'extended' : 'idle',
      pusherD: routingLike && category === 'D' ? 'extended' : 'idle',
    },
    pid: {
      targetSpeedMps: 1,
      actualSpeedMps: playback.status === 'running' ? playback.speed : 0,
      pidError: 0,
      correction: 0,
      speedHistoryMps: [],
    },
    events: playback.events,
    activeRoute: routingLike ? category : undefined,
  };
}
