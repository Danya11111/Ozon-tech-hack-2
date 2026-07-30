/**
 * Stage 2B §10–12, §25 — continuous measurement: the item NEVER stops under
 * the camera; scan progress is position-based; classification completes
 * before mechanism contact; physics handoff does not pre-position the item
 * on the chute before the paddle touches it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { CASE_PHASES, createPlaybackState, startPlayback, updatePlayback } from './continuousPlayback';
import { getPhysicalItemPose, getDropHandoffTimeMs, getRoutingStartMs } from './physicalItemMotion';
import { deriveSorterVisualState } from './sorterVisualState';
import {
  SCAN_START_X, SCAN_END_X, CLASSIFICATION_DEADLINE_X, MECHANISM_CONTACT_X,
  getScanProgress, getScanWindow,
} from './measurementZone';
import { ZONES, CONVEYOR_SPEED_MPS, BELT_TOP_Y } from './physicalLayout';
import { resolveItem } from '../data/resolveItem';
import { initRapier, simulateDrop } from './physicsDropSim';

function poseAt(skuId: string, category: 'B' | 'C' | 'D', elapsedMs: number) {
  const item = resolveItem(skuId);
  return getPhysicalItemPose({
    caseId: 't', slotIndex: 0, dimensionsMm: item.dimensionsMm,
    targetCategory: category, elapsedMs, faultType: undefined,
  });
}

function phaseStarts(): Record<string, number> {
  const starts: Record<string, number> = {};
  let acc = 0;
  for (const p of CASE_PHASES) { starts[p.phase] = acc; acc += p.durationMs; }
  return starts;
}

describe('Stage 2B §10 — no stop under the camera', () => {
  it('item moves at belt speed through the entire measurement window', () => {
    const starts = phaseStarts();
    const detectionStart = starts['detection'];
    const commandEnd = starts['routing'];
    let prevX = -Infinity;
    for (let t = detectionStart; t <= commandEnd; t += 50) {
      const pose = poseAt('SKU-001', 'B', t);
      expect(pose.position[0]).toBeGreaterThan(prevX); // strictly increasing
      prevX = pose.position[0];
    }
    // exact belt speed: x advances CONVEYOR_SPEED_MPS per second
    const x1 = poseAt('SKU-001', 'B', detectionStart + 1000).position[0];
    const x2 = poseAt('SKU-001', 'B', detectionStart + 2000).position[0];
    expect(x2 - x1).toBeCloseTo(CONVEYOR_SPEED_MPS * 1.0, 5);
  });

  it('belt velocity stays positive during detection/measurement phases', () => {
    let state = startPlayback(createPlaybackState());
    const starts = phaseStarts();
    const measurementMid = starts['measurement'] + 300;
    // advance playback to mid-measurement
    let guard = 0;
    while (state.caseElapsedMs < measurementMid && guard < 100000) {
      state = updatePlayback(state, 50);
      guard += 50;
    }
    expect(state.currentPhase === 'measurement' || state.currentPhase === 'classification').toBe(true);
    const vs = deriveSorterVisualState(state);
    expect(vs.beltVelocityMps).toBeGreaterThan(0);
  });

  it('item reaches the gate exactly at routing start (no gate dwell, no overshoot)', () => {
    const routingStart = getRoutingStartMs();
    const pose = poseAt('SKU-001', 'B', routingStart);
    expect(pose.position[0]).toBeCloseTo(ZONES.GATE.x, 5);
    // belt speed continuity: distance from A == speed * travel time
    const feedStart = phaseStarts()['move_to_detection'];
    const travelS = (routingStart - feedStart) / 1000;
    expect(ZONES.GATE.x - ZONES.A.x).toBeCloseTo(CONVEYOR_SPEED_MPS * travelS, 5);
  });
});

describe('Stage 2B §12 — position-based scan progress', () => {
  it('scan progress derives from item position, not time', () => {
    expect(getScanProgress(SCAN_START_X)).toBe(0);
    expect(getScanProgress((SCAN_START_X + SCAN_END_X) / 2)).toBeCloseTo(0.5, 6);
    expect(getScanProgress(SCAN_END_X)).toBe(1);
    expect(getScanProgress(SCAN_START_X - 1)).toBe(0);
    expect(getScanProgress(SCAN_END_X + 1)).toBe(1);
    expect(getScanWindow(ZONES.CAMERA.x)).toBe('scanning');
    expect(getScanWindow(ZONES.GATE.x)).toBe('complete');
  });

  it('scan window matches item pose during continuous travel', () => {
    const starts = phaseStarts();
    const routingStart = starts['routing'];
    let sawScanning = false;
    let sawComplete = false;
    for (let t = starts['move_to_detection']; t < routingStart; t += 20) {
      const x = poseAt('SKU-001', 'B', t).position[0];
      const w = getScanWindow(x);
      if (w === 'scanning') sawScanning = true;
      if (w === 'complete') sawComplete = true;
    }
    expect(sawScanning).toBe(true);
    expect(sawComplete).toBe(true); // item leaves the frustum before routing
  });
});

describe('Stage 2B §11 — classification completes before mechanism contact', () => {
  it('classification phase ends at or before the deadline position', () => {
    const starts = phaseStarts();
    const classificationEnd = starts['command_sent'];
    const x = poseAt('SKU-001', 'B', classificationEnd).position[0];
    expect(x).toBeLessThanOrEqual(CLASSIFICATION_DEADLINE_X + 1e-9);
    expect(x).toBeLessThan(MECHANISM_CONTACT_X); // well ahead of the gate
  });
});

describe('Stage 2B §13 — handoff not before mechanism contact', () => {
  beforeAll(async () => { await initRapier(); });

  it('C/D handoff happens at the junction (belt center), never pre-positioned on the chute', () => {
    const routingStart = getRoutingStartMs();
    for (const category of ['C', 'D'] as const) {
      expect(getDropHandoffTimeMs(category, undefined)).toBe(routingStart);
      const pose = poseAt('SKU-001', category, getDropHandoffTimeMs(category, undefined)!);
      expect(Math.abs(pose.position[2])).toBeLessThan(0.01); // belt center z=0
      expect(pose.position[0]).toBeCloseTo(ZONES.GATE.x, 5);
      expect(pose.position[1]).toBeCloseTo(BELT_TOP_Y + 0.1, 5); // box h/2 = 0.1
    }
  });

  it('paddle collider actually contacts the item collider on every C/D route', () => {
    for (const [sku, zone] of [['SKU-004', 'C'], ['SKU-009', 'C'], ['SKU-011', 'C'], ['SKU-006', 'D'], ['SKU-007', 'D'], ['SKU-008', 'D']] as const) {
      const r = simulateDrop(sku, zone);
      expect(r.pusherContactMade).toBe(true);
    }
  });

  it('no positional teleport: handoff pose is continuous with the pre-handoff kinematic pose', () => {
    const routingStart = getRoutingStartMs();
    const before = poseAt('SKU-001', 'C', routingStart - 1);
    const at = poseAt('SKU-001', 'C', routingStart);
    expect(Math.abs(at.position[0] - before.position[0])).toBeLessThan(0.01);
    expect(Math.abs(at.position[2] - before.position[2])).toBeLessThan(0.01);
  });
});
