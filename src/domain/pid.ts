import type { PidState } from './types';

export function createPidState(targetSpeedMps = 0.42): PidState {
  return {
    targetSpeedMps,
    actualSpeedMps: 0,
    pidError: targetSpeedMps,
    correction: 0,
  };
}

export function updatePid(state: PidState, targetSpeedMps: number, deltaMs: number): PidState {
  const dt = Math.max(deltaMs / 1000, 0.1);
  const pidError = targetSpeedMps - state.actualSpeedMps;
  const correction = pidError * 0.42;
  const nextActual = Math.max(0, state.actualSpeedMps + correction * dt);

  return {
    targetSpeedMps,
    actualSpeedMps: Number(nextActual.toFixed(3)),
    pidError: Number(pidError.toFixed(3)),
    correction: Number(correction.toFixed(3)),
  };
}
