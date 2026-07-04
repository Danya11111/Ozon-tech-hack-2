import { describe, expect, it } from 'vitest';
import { createPidState, updatePid } from './pid';
import { NOMINAL_CONVEYOR_SPEED_MPS } from './simulation';

describe('PID conveyor speed imitation', () => {
  it('uses 1.00 m/s as default conveyor target', () => {
    expect(NOMINAL_CONVEYOR_SPEED_MPS).toBe(1);
    expect(NOMINAL_CONVEYOR_SPEED_MPS.toFixed(2)).toBe('1.00');
    const pid = createPidState();
    expect(pid.targetSpeedMps).toBe(NOMINAL_CONVEYOR_SPEED_MPS);
  });

  it('moves actual speed toward target in normal mode', () => {
    let pid = createPidState(1);

    for (let index = 0; index < 20; index += 1) {
      pid = updatePid(pid, 1, 250);
    }

    expect(pid.actualSpeedMps).toBeGreaterThan(0.7);
    expect(Math.abs(pid.pidError)).toBeLessThan(0.35);
  });


  it('decays actual speed toward zero when target is stopped', () => {
    let pid = createPidState(1);

    for (let index = 0; index < 20; index += 1) {
      pid = updatePid(pid, 1, 250);
    }
    const runningSpeed = pid.actualSpeedMps;

    for (let index = 0; index < 30; index += 1) {
      pid = updatePid(pid, 0, 250);
    }

    expect(pid.actualSpeedMps).toBeLessThan(runningSpeed);
    expect(pid.actualSpeedMps).toBeLessThan(0.12);
  });
});
