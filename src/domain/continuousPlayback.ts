/**
 * Continuous Playback Engine — manages auto-demo on main page.
 * Classification is always driven by classifyItem (live rule engine).
 * Supports speed control, case seek, seeded variability, and event journal.
 */

import type { Category, ClassificationResult, EventLogEntry } from './types';
import { DEMO_PLAYLIST, type PlaylistCase, PLAYLIST_LENGTH } from './demoPlaylist';
import { classifyItem } from './classifier';
import { resolveItem } from '../data/resolveItem';
import { createSeededRng, DEFAULT_DEMO_SEED, seededOffset } from './seededRng';

/** Playback status for the continuous demo. */
export type PlaybackStatus = 'idle' | 'running' | 'paused' | 'finished';

/** Phase within a single case timeline. */
export type CasePhase =
  | 'spawn'
  | 'move_to_detection'
  | 'detection'
  | 'measurement'
  | 'classification'
  | 'command_sent'
  | 'routing'
  | 'exit'
  | 'clear_gap'
  | 'fault_hold'
  | 'emergency_hold'
  | 'recover';

/** Phase configuration with duration based on conveyor speed (1 m/s). */
export interface PhaseConfig {
  phase: CasePhase;
  durationMs: number;
  label: string;
}

/**
 * Timeline phases for a single normal item.
 * Distances are in meters, speed is 1 m/s, so duration = distance * 1000 ms.
 */
export const CASE_PHASES: PhaseConfig[] = [
  { phase: 'spawn', durationMs: 300, label: 'Spawn at A' },
  { phase: 'move_to_detection', durationMs: 2500, label: 'Moving to camera' },
  { phase: 'detection', durationMs: 600, label: 'CV Detection' },
  { phase: 'measurement', durationMs: 1000, label: 'Laser measurement' },
  { phase: 'classification', durationMs: 1000, label: 'Classification' },
  { phase: 'command_sent', durationMs: 1000, label: 'Command sent' },
  { phase: 'routing', durationMs: 2500, label: 'Routing to zone' },
  { phase: 'exit', durationMs: 400, label: 'Exit to zone' },
  { phase: 'clear_gap', durationMs: 500, label: 'Clear gap' },
];

/** Safety timeline: jam near gate then recover. */
export const JAM_CASE_PHASES: PhaseConfig[] = [
  { phase: 'spawn', durationMs: 300, label: 'Spawn at A' },
  { phase: 'move_to_detection', durationMs: 2000, label: 'Moving to camera' },
  { phase: 'detection', durationMs: 500, label: 'CV Detection' },
  { phase: 'measurement', durationMs: 800, label: 'Laser measurement' },
  { phase: 'classification', durationMs: 600, label: 'Classification' },
  { phase: 'fault_hold', durationMs: 2800, label: 'JAM / FAULT' },
  { phase: 'recover', durationMs: 1200, label: 'Recovery' },
  { phase: 'clear_gap', durationMs: 400, label: 'Clear gap' },
];

/** Safety timeline: emergency stop. */
export const ESTOP_CASE_PHASES: PhaseConfig[] = [
  { phase: 'spawn', durationMs: 300, label: 'Spawn at A' },
  { phase: 'move_to_detection', durationMs: 1800, label: 'Moving to camera' },
  { phase: 'detection', durationMs: 400, label: 'CV Detection' },
  { phase: 'emergency_hold', durationMs: 3000, label: 'EMERGENCY STOP' },
  { phase: 'recover', durationMs: 1500, label: 'System reset' },
  { phase: 'clear_gap', durationMs: 400, label: 'Clear gap' },
];

/** Total duration of one normal case in ms. */
export const CASE_DURATION_MS = CASE_PHASES.reduce((sum, p) => sum + p.durationMs, 0);

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export interface ContinuousPlaybackState {
  status: PlaybackStatus;
  currentCaseIndex: number;
  currentCase: PlaylistCase;
  currentPhaseIndex: number;
  currentPhase: CasePhase;
  phaseElapsedMs: number;
  caseElapsedMs: number;
  totalElapsedMs: number;
  loopMode: boolean;
  targetCategory: Category | null;
  classification: ClassificationResult | null;
  command: string;
  warning: string | null;
  /** Playback speed multiplier */
  speed: PlaybackSpeed;
  /** Seed for reproducible variability */
  seed: number;
  /** Deterministic position jitter (mm-scale visual offsets stored as meters) */
  positionJitter: { x: number; z: number; yaw: number };
  /** Bounded event journal for proof / engineering HUD */
  events: EventLogEntry[];
}

function phasesForCase(playlistCase: PlaylistCase): PhaseConfig[] {
  if (playlistCase.faultType === 'jam') return JAM_CASE_PHASES;
  if (playlistCase.faultType === 'emergency_stop') return ESTOP_CASE_PHASES;
  return CASE_PHASES;
}

export function getPlaylistCaseDurationMs(playlistCase: PlaylistCase): number {
  return phasesForCase(playlistCase).reduce((sum, p) => sum + p.durationMs, 0);
}

/** Cumulative playlist duration before case index (supports wrap for loops). */
export function cumulativePlaylistDurationMs(caseIndex: number): number {
  let sum = 0;
  for (let i = 0; i < caseIndex; i++) {
    sum += getPlaylistCaseDurationMs(DEMO_PLAYLIST[i % PLAYLIST_LENGTH]);
  }
  return sum;
}

function caseDurationMs(playlistCase: PlaylistCase): number {
  return getPlaylistCaseDurationMs(playlistCase);
}

function classifyCase(playlistCase: PlaylistCase): ClassificationResult {
  const item = resolveItem(playlistCase.itemId);
  return classifyItem(item);
}

function buildJitter(seed: number, caseIndex: number): { x: number; z: number; yaw: number } {
  const rng = createSeededRng(seed + caseIndex * 9973);
  return {
    x: seededOffset(rng, 0.012),
    z: seededOffset(rng, 0.008),
    yaw: seededOffset(rng, 0.04),
  };
}

let eventCounter = 0;

function pushEvent(
  events: EventLogEntry[],
  timestampMs: number,
  entry: Omit<EventLogEntry, 'id' | 'timestampMs'>,
): EventLogEntry[] {
  eventCounter += 1;
  const next: EventLogEntry = {
    id: `pb-evt-${eventCounter}`,
    timestampMs,
    ...entry,
  };
  return [next, ...events].slice(0, 40);
}

function initCaseFields(playlistCase: PlaylistCase, seed: number, caseIndex: number, events: EventLogEntry[], simTime: number) {
  const classification = classifyCase(playlistCase);
  const warnings = [
    ...(playlistCase.warning ? [playlistCase.warning] : []),
    ...classification.warnings,
  ];
  return {
    currentCase: playlistCase,
    currentCaseIndex: caseIndex,
    currentPhaseIndex: 0,
    currentPhase: 'spawn' as CasePhase,
    phaseElapsedMs: 0,
    caseElapsedMs: 0,
    targetCategory: classification.category,
    classification,
    command: 'IDLE',
    warning: warnings[0] ?? null,
    positionJitter: buildJitter(seed, caseIndex),
    events: pushEvent(events, simTime, {
      itemId: playlistCase.itemId,
      type: 'system',
      message: `Case start: ${playlistCase.title}`,
      category: classification.category,
      status: 'info',
    }),
  };
}

/** Create initial playback state. */
export function createPlaybackState(seed: number = DEFAULT_DEMO_SEED): ContinuousPlaybackState {
  const firstCase = DEMO_PLAYLIST[0];
  const classification = classifyCase(firstCase);
  return {
    status: 'idle',
    currentCaseIndex: 0,
    currentCase: firstCase,
    currentPhaseIndex: 0,
    currentPhase: 'spawn',
    phaseElapsedMs: 0,
    caseElapsedMs: 0,
    totalElapsedMs: 0,
    loopMode: false,
    targetCategory: null,
    classification: null,
    command: 'IDLE',
    warning: null,
    speed: 1,
    seed,
    positionJitter: { x: 0, z: 0, yaw: 0 },
    events: [],
  };
}

/** Start playback from the beginning. */
export function startPlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  const firstCase = DEMO_PLAYLIST[0];
  const fields = initCaseFields(firstCase, state.seed, 0, [], 0);
  return {
    ...state,
    status: 'running',
    totalElapsedMs: 0,
    speed: state.speed,
    seed: state.seed,
    loopMode: state.loopMode,
    ...fields,
  };
}

export function pausePlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused' };
}

export function resumePlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'running' };
}

export function stopPlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  return createPlaybackState(state.seed);
}

export function toggleLoopMode(state: ContinuousPlaybackState): ContinuousPlaybackState {
  return { ...state, loopMode: !state.loopMode };
}

export function setPlaybackSpeed(state: ContinuousPlaybackState, speed: PlaybackSpeed): ContinuousPlaybackState {
  return { ...state, speed };
}

/** Jump to a playlist case index (keeps running/paused status). */
export function seekToCase(state: ContinuousPlaybackState, caseIndex: number): ContinuousPlaybackState {
  const idx = ((caseIndex % PLAYLIST_LENGTH) + PLAYLIST_LENGTH) % PLAYLIST_LENGTH;
  const nextCase = DEMO_PLAYLIST[idx];
  const fields = initCaseFields(nextCase, state.seed, idx, state.events, state.totalElapsedMs);
  const status = state.status === 'idle' || state.status === 'finished' ? 'running' : state.status;
  return {
    ...state,
    status,
    ...fields,
  };
}

export function seekNextCase(state: ContinuousPlaybackState): ContinuousPlaybackState {
  return seekToCase(state, state.currentCaseIndex + 1);
}

export function seekPrevCase(state: ContinuousPlaybackState): ContinuousPlaybackState {
  return seekToCase(state, state.currentCaseIndex - 1);
}

function advanceToNextCase(state: ContinuousPlaybackState): ContinuousPlaybackState {
  const nextIndex = state.currentCaseIndex + 1;

  if (nextIndex >= PLAYLIST_LENGTH) {
    if (state.loopMode) {
      const firstCase = DEMO_PLAYLIST[0];
      const fields = initCaseFields(firstCase, state.seed, 0, state.events, state.totalElapsedMs);
      return { ...state, ...fields };
    }
    return {
      ...state,
      status: 'finished',
      command: 'COMPLETE',
      events: pushEvent(state.events, state.totalElapsedMs, {
        type: 'system',
        message: 'Playlist complete',
        status: 'success',
      }),
    };
  }

  const nextCase = DEMO_PLAYLIST[nextIndex];
  const fields = initCaseFields(nextCase, state.seed, nextIndex, state.events, state.totalElapsedMs);
  return { ...state, ...fields };
}

function getCommandForPhase(phase: CasePhase, category: Category): string {
  switch (phase) {
    case 'spawn':
    case 'move_to_detection':
      return 'MOVING_TO_CAMERA';
    case 'detection':
      return 'DETECTING';
    case 'measurement':
      return 'MEASURING';
    case 'classification':
      return 'CLASSIFYING';
    case 'command_sent':
    case 'routing':
    case 'exit':
      return `ROUTE_TO_${category}`;
    case 'fault_hold':
      return 'FAULT';
    case 'emergency_hold':
      return 'EMERGENCY_STOP';
    case 'recover':
      return 'RECOVERING';
    case 'clear_gap':
      return 'RETURN_HOME';
    default:
      return 'IDLE';
  }
}

function maybeLogPhaseTransition(
  state: ContinuousPlaybackState,
  phase: CasePhase,
  category: Category,
): EventLogEntry[] {
  let events = state.events;
  if (phase === 'classification' && state.classification) {
    events = pushEvent(events, state.totalElapsedMs, {
      itemId: state.currentCase.itemId,
      type: 'classification',
      message: `${state.classification.label}: ${state.classification.reason}`,
      category: state.classification.category,
      command: 'CLASSIFY_RULE_BASED',
      status: state.classification.warnings.length ? 'warning' : 'success',
    });
  }
  if (phase === 'command_sent') {
    events = pushEvent(events, state.totalElapsedMs, {
      itemId: state.currentCase.itemId,
      type: 'routing',
      message: `Command ROUTE_TO_${category}`,
      category,
      command: `ROUTE_TO_${category}`,
      status: 'success',
    });
  }
  if (phase === 'fault_hold') {
    events = pushEvent(events, state.totalElapsedMs, {
      itemId: state.currentCase.itemId,
      type: 'fault',
      message: 'Jam detected at stop-gate — conveyor halted',
      command: 'FAULT',
      status: 'error',
    });
  }
  if (phase === 'emergency_hold') {
    events = pushEvent(events, state.totalElapsedMs, {
      itemId: state.currentCase.itemId,
      type: 'fault',
      message: 'Emergency stop engaged — all motion frozen',
      command: 'EMERGENCY_STOP',
      status: 'error',
    });
  }
  if (phase === 'recover') {
    events = pushEvent(events, state.totalElapsedMs, {
      type: 'system',
      message: 'Recovery sequence started',
      command: 'RECOVER',
      status: 'warning',
    });
  }
  return events;
}

/** Update playback state with elapsed wall-clock time (scaled by speed). */
export function updatePlayback(
  state: ContinuousPlaybackState,
  deltaMs: number,
): ContinuousPlaybackState {
  if (state.status !== 'running') {
    return state;
  }

  const scaledDelta = deltaMs * state.speed;
  let newState = { ...state };
  newState.phaseElapsedMs += scaledDelta;
  newState.caseElapsedMs += scaledDelta;
  newState.totalElapsedMs += scaledDelta;

  const phases = phasesForCase(newState.currentCase);
  const currentPhaseConfig = phases[newState.currentPhaseIndex];

  if (newState.phaseElapsedMs >= currentPhaseConfig.durationMs) {
    const nextPhaseIndex = newState.currentPhaseIndex + 1;

    if (nextPhaseIndex >= phases.length) {
      newState = advanceToNextCase(newState);
    } else {
      newState.currentPhaseIndex = nextPhaseIndex;
      newState.currentPhase = phases[nextPhaseIndex].phase;
      newState.phaseElapsedMs = 0;
      if (newState.targetCategory) {
        newState.events = maybeLogPhaseTransition(newState, newState.currentPhase, newState.targetCategory);
      }
    }
  }

  if (newState.status === 'running' && newState.targetCategory) {
    newState.command = getCommandForPhase(newState.currentPhase, newState.targetCategory);
  }

  return newState;
}

export function getCasePhases(state: ContinuousPlaybackState): PhaseConfig[] {
  return phasesForCase(state.currentCase);
}

export function getCaseDurationMs(state: ContinuousPlaybackState): number {
  return caseDurationMs(state.currentCase);
}

export function getCaseProgress(state: ContinuousPlaybackState): number {
  return Math.min(state.caseElapsedMs / getCaseDurationMs(state), 1);
}

export function getPhaseProgress(state: ContinuousPlaybackState): number {
  const phases = getCasePhases(state);
  const phaseConfig = phases[state.currentPhaseIndex];
  return Math.min(state.phaseElapsedMs / phaseConfig.durationMs, 1);
}

export function getCurrentPhaseConfig(state: ContinuousPlaybackState): PhaseConfig {
  return getCasePhases(state)[state.currentPhaseIndex];
}

export function isDetectionActive(state: ContinuousPlaybackState): boolean {
  return state.currentPhase === 'detection' || state.currentPhase === 'measurement';
}

export function isRoutingActive(state: ContinuousPlaybackState): boolean {
  return state.currentPhase === 'routing' || state.currentPhase === 'exit';
}

export function isFaultActive(state: ContinuousPlaybackState): boolean {
  return state.currentPhase === 'fault_hold' || state.currentPhase === 'emergency_hold';
}

export function getTotalProgress(state: ContinuousPlaybackState): number {
  const completedCases = state.currentCaseIndex;
  const currentCaseProgress = getCaseProgress(state);
  return (completedCases + currentCaseProgress) / PLAYLIST_LENGTH;
}

/** Assert playlist expectedCategory matches live classifier (for tests). */
export function assertPlaylistClassifierConsistency(): Array<{ id: string; expected: Category; actual: Category }> {
  const mismatches: Array<{ id: string; expected: Category; actual: Category }> = [];
  for (const c of DEMO_PLAYLIST) {
    if (c.faultType) continue;
    const result = classifyCase(c);
    if (result.category !== c.expectedCategory) {
      mismatches.push({ id: c.id, expected: c.expectedCategory, actual: result.category });
    }
  }
  return mismatches;
}
