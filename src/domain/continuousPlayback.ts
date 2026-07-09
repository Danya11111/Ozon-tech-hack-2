/**
 * Continuous Playback Engine — manages 8-case auto-demo on main page.
 * Controls playlist progression, timing, and phase transitions.
 */

import type { Category } from './types';
import { DEMO_PLAYLIST, type PlaylistCase, PLAYLIST_LENGTH } from './demoPlaylist';

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
  | 'clear_gap';

/** Phase configuration with duration based on conveyor speed (1 m/s). */
export interface PhaseConfig {
  phase: CasePhase;
  durationMs: number;
  label: string;
}

/**
 * Timeline phases for a single item.
 * Distances are in meters, speed is 1 m/s, so duration = distance * 1000 ms.
 */
export const CASE_PHASES: PhaseConfig[] = [
  { phase: 'spawn', durationMs: 300, label: 'Spawn at A' },
  { phase: 'move_to_detection', durationMs: 2500, label: 'Moving to camera' },  // 2.5m at 1m/s
  { phase: 'detection', durationMs: 600, label: 'CV Detection' },
  { phase: 'measurement', durationMs: 1000, label: 'Laser measurement' }, // 1.0m at 1m/s
  { phase: 'classification', durationMs: 1000, label: 'Classification' }, // 1.0m at 1m/s
  { phase: 'command_sent', durationMs: 1000, label: 'Command sent' }, // 1.0m at 1m/s
  { phase: 'routing', durationMs: 2500, label: 'Routing to zone' },  // 2.5m B-route at 1m/s
  { phase: 'exit', durationMs: 400, label: 'Exit to zone' },
  { phase: 'clear_gap', durationMs: 500, label: 'Clear gap' },
];

/** Total duration of one case in ms. */
export const CASE_DURATION_MS = CASE_PHASES.reduce((sum, p) => sum + p.durationMs, 0);

/** Continuous playback state. */
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
  command: string;
  warning: string | null;
}

/** Create initial playback state. */
export function createPlaybackState(): ContinuousPlaybackState {
  const firstCase = DEMO_PLAYLIST[0];
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
    command: 'IDLE',
    warning: null,
  };
}

/** Start playback from the beginning. */
export function startPlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  const firstCase = DEMO_PLAYLIST[0];
  return {
    ...state,
    status: 'running',
    currentCaseIndex: 0,
    currentCase: firstCase,
    currentPhaseIndex: 0,
    currentPhase: 'spawn',
    phaseElapsedMs: 0,
    caseElapsedMs: 0,
    totalElapsedMs: 0,
    targetCategory: firstCase.expectedCategory,
    command: 'IDLE',
    warning: firstCase.warning ?? null,
  };
}

/** Pause playback. */
export function pausePlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused' };
}

/** Resume playback. */
export function resumePlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'running' };
}

/** Stop and reset playback. */
export function stopPlayback(state: ContinuousPlaybackState): ContinuousPlaybackState {
  return createPlaybackState();
}

/** Toggle loop mode. */
export function toggleLoopMode(state: ContinuousPlaybackState): ContinuousPlaybackState {
  return { ...state, loopMode: !state.loopMode };
}

/** Advance to the next case. */
function advanceToNextCase(state: ContinuousPlaybackState): ContinuousPlaybackState {
  const nextIndex = state.currentCaseIndex + 1;
  
  // Check if we've completed all cases
  if (nextIndex >= PLAYLIST_LENGTH) {
    if (state.loopMode) {
      // Loop back to first case
      const firstCase = DEMO_PLAYLIST[0];
      return {
        ...state,
        currentCaseIndex: 0,
        currentCase: firstCase,
        currentPhaseIndex: 0,
        currentPhase: 'spawn',
        phaseElapsedMs: 0,
        caseElapsedMs: 0,
        targetCategory: firstCase.expectedCategory,
        command: 'IDLE',
        warning: firstCase.warning ?? null,
      };
    } else {
      // Finished all cases
      return {
        ...state,
        status: 'finished',
        command: 'COMPLETE',
      };
    }
  }
  
  // Advance to next case
  const nextCase = DEMO_PLAYLIST[nextIndex];
  return {
    ...state,
    currentCaseIndex: nextIndex,
    currentCase: nextCase,
    currentPhaseIndex: 0,
    currentPhase: 'spawn',
    phaseElapsedMs: 0,
    caseElapsedMs: 0,
    targetCategory: nextCase.expectedCategory,
    command: 'IDLE',
    warning: nextCase.warning ?? null,
  };
}

/** Get command for current phase. */
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
    case 'clear_gap':
      return 'RETURN_HOME';
    default:
      return 'IDLE';
  }
}

/** Update playback state with elapsed time. */
export function updatePlayback(
  state: ContinuousPlaybackState,
  deltaMs: number,
): ContinuousPlaybackState {
  if (state.status !== 'running') {
    return state;
  }

  let newState = { ...state };
  newState.phaseElapsedMs += deltaMs;
  newState.caseElapsedMs += deltaMs;
  newState.totalElapsedMs += deltaMs;

  // Check if current phase is complete
  const currentPhaseConfig = CASE_PHASES[newState.currentPhaseIndex];
  if (newState.phaseElapsedMs >= currentPhaseConfig.durationMs) {
    // Advance to next phase
    const nextPhaseIndex = newState.currentPhaseIndex + 1;
    
    if (nextPhaseIndex >= CASE_PHASES.length) {
      // Case complete, advance to next case
      newState = advanceToNextCase(newState);
    } else {
      // Move to next phase
      newState.currentPhaseIndex = nextPhaseIndex;
      newState.currentPhase = CASE_PHASES[nextPhaseIndex].phase;
      newState.phaseElapsedMs = 0;
    }
  }

  // Update command based on phase
  if (newState.status === 'running' && newState.targetCategory) {
    newState.command = getCommandForPhase(newState.currentPhase, newState.targetCategory);
  }

  return newState;
}

/** Get progress within current case (0 to 1). */
export function getCaseProgress(state: ContinuousPlaybackState): number {
  return Math.min(state.caseElapsedMs / CASE_DURATION_MS, 1);
}

/** Get progress within current phase (0 to 1). */
export function getPhaseProgress(state: ContinuousPlaybackState): number {
  const phaseConfig = CASE_PHASES[state.currentPhaseIndex];
  return Math.min(state.phaseElapsedMs / phaseConfig.durationMs, 1);
}

/** Get current phase configuration. */
export function getCurrentPhaseConfig(state: ContinuousPlaybackState): PhaseConfig {
  return CASE_PHASES[state.currentPhaseIndex];
}

/** Check if detection is active. */
export function isDetectionActive(state: ContinuousPlaybackState): boolean {
  return state.currentPhase === 'detection' || state.currentPhase === 'measurement';
}

/** Check if routing is active. */
export function isRoutingActive(state: ContinuousPlaybackState): boolean {
  return state.currentPhase === 'routing' || state.currentPhase === 'exit';
}

/** Get total playlist progress (0 to 1). */
export function getTotalProgress(state: ContinuousPlaybackState): number {
  const completedCases = state.currentCaseIndex;
  const currentCaseProgress = getCaseProgress(state);
  return (completedCases + currentCaseProgress) / PLAYLIST_LENGTH;
}
