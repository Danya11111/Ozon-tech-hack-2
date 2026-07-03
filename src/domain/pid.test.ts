import { describe, expect, it } from 'vitest';
import { createPidState, updatePid } from './pid';

describe('PID conveyor speed imitation', () => {
  it('moves actual speed toward target in normal mode', () => {
    let pid = createPidState(0.42);

    for (let index = 0; index < 20; index += 1) {
      pid = updatePid(pid, 0.42, 250);
    }

    expect(pid.actualSpeedMps).toBeGreaterThan(0.3);
    expect(Math.abs(pid.pidError)).toBeLessThan(0.15);
  });

  it('decays actual speed toward zero when target is stopped', () => {
    let pid = createPidState(0.42);

    for (let index = 0; index < 20; index += 1) {
      pid = updatePid(pid, 0.42, 250);
    }
    const runningSpeed = pid.actualSpeedMps;

    for (let index = 0; index < 30; index += 1) {
      pid = updatePid(pid, 0, 250);
    }

    expect(pid.actualSpeedMps).toBeLessThan(runningSpeed);
    expect(pid.actualSpeedMps).toBeLessThan(0.05);
  });
});
