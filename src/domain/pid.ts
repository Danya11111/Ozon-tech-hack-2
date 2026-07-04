import type { PidState } from './types';

const PID_HISTORY_LIMIT = 40;

export function createPidState(targetSpeedMps = 1): PidState {
  return {
    targetSpeedMps,
    actualSpeedMps: 0,
    pidError: targetSpeedMps,
    correction: 0,
    speedHistoryMps: [0],
  };
}

export function updatePid(state: PidState, targetSpeedMps: number, deltaMs: number): PidState {
  const dt = Math.max(deltaMs / 1000, 0.1);
  const pidError = targetSpeedMps - state.actualSpeedMps;
  const correction = pidError * 0.42;
  const nextActual = Math.max(0, state.actualSpeedMps + correction * dt);
  const actualSpeedMps = Number(nextActual.toFixed(3));
  const speedHistoryMps = [...state.speedHistoryMps, actualSpeedMps].slice(-PID_HISTORY_LIMIT);

  return {
    targetSpeedMps,
    actualSpeedMps,
    pidError: Number(pidError.toFixed(3)),
    correction: Number(correction.toFixed(3)),
    speedHistoryMps,
  };
}
