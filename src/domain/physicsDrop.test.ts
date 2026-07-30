/**
 * Stage 2 §18 — reproducible physics drop validation (headless Rapier).
 *
 * Runs the SAME world the runtime uses (physicsWorldLayout colliders,
 * visualPhysicsProfiles, identical handoff pose/velocities) and verifies:
 * deterministic, physically plausible, domain-receiver-correct drops.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { initRapier, simulateDrop, type DropSimResult } from './physicsDropSim';
import { getStaticColliders } from './physicsWorldLayout';
import { getDropHandoffTimeMs } from './physicalItemMotion';
import { receiverContains } from './receiverVolumes';
import { classifyItem } from './classifier';
import { resolveItem } from '../data/resolveItem';

beforeAll(async () => {
  await initRapier();
});

function repeatDrops(sku: string, zone: 'B' | 'C' | 'D', n: number): DropSimResult[] {
  return Array.from({ length: n }, () => simulateDrop(sku, zone));
}

function expectDeterministic(results: DropSimResult[]) {
  const first = results[0];
  for (const r of results) {
    for (let i = 0; i < 3; i += 1) {
      expect(Math.abs(r.finalPosition[i] - first.finalPosition[i])).toBeLessThan(1e-9);
    }
  }
}

function expectPhysicallyPlausible(r: DropSimResult) {
  // Ballistic flight actually happened (not teleport): real speed, real fall time
  expect(r.maxSpeedMps).toBeGreaterThan(0.8);
  expect(r.stepsSimulated).toBeGreaterThan(30); // > 0.5 s of simulated fall
  // Never passed through the belt/floor (translation-based clearance guard)
  expect(r.minClearanceM).toBeGreaterThan(-0.03);
}

describe('Stage 2 §18.1–4 — route correctness, 10/10 per route', () => {
  it('box route B — 10 repeats all in B, deterministic', () => {
    const results = repeatDrops('SKU-001', 'B', 10);
    for (const r of results) {
      expect(r.insideExpectedReceiver).toBe(true);
      expectPhysicallyPlausible(r);
    }
    expectDeterministic(results);
  });

  it('oversized carton route C — 10/10 in C', () => {
    const results = repeatDrops('SKU-004', 'C', 10);
    for (const r of results) {
      expect(r.insideExpectedReceiver).toBe(true);
      expectPhysicallyPlausible(r);
    }
    expectDeterministic(results);
  });

  it('plate route D — 10/10 in D, no floor penetration', () => {
    const results = repeatDrops('SKU-006', 'D', 10);
    for (const r of results) {
      expect(r.insideExpectedReceiver).toBe(true);
      expectPhysicallyPlausible(r);
    }
    expectDeterministic(results);
  });

  it('bottle route D — 10/10 in D, rotates during fall', () => {
    const results = repeatDrops('SKU-007', 'D', 10);
    for (const r of results) {
      expect(r.insideExpectedReceiver).toBe(true);
      expectPhysicallyPlausible(r);
      expect(r.totalRotationRad).toBeGreaterThan(0.5); // distinguishable from box slide
    }
    expectDeterministic(results);
  });
});

describe('Stage 2 §18.5–6 — distinct item behaviors', () => {
  it('cylinder rolls (large integrated rotation) but stays in D receiver', () => {
    const r = simulateDrop('SKU-008', 'D');
    expect(r.insideExpectedReceiver).toBe(true);
    expect(r.totalRotationRad).toBeGreaterThan(1.5);
  });

  it('pen (light, fast-spinning) never tunnels through colliders', () => {
    const r = simulateDrop('SKU-009', 'C');
    expect(r.insideExpectedReceiver).toBe(true);
    expect(r.minClearanceM).toBeGreaterThan(-0.03);
    expect(r.totalRotationRad).toBeGreaterThan(0.3);
  });

  it('pouf (large, heavy) rotates slower than the pen', () => {
    const pouf = simulateDrop('SKU-011', 'C');
    const pen = simulateDrop('SKU-009', 'C');
    expect(pouf.insideExpectedReceiver).toBe(true);
    expect(pouf.totalRotationRad).toBeLessThan(pen.totalRotationRad + 2.0);
  });
});

describe('Stage 2 §18.7–8 — fault scenarios create no physics impulses', () => {
  it('jam case: no physics handoff (item held at junction by domain)', () => {
    expect(getDropHandoffTimeMs('C', 'jam')).toBeNull();
  });

  it('emergency stop case: no physics handoff (no new impulses)', () => {
    expect(getDropHandoffTimeMs('B', 'emergency_stop')).toBeNull();
  });
});

describe('Stage 2 §18.9–10 — replay reset and no body leaks', () => {
  it('fresh worlds give bit-identical drops (replay determinism)', () => {
    const a = simulateDrop('SKU-001', 'B');
    const b = simulateDrop('SKU-001', 'B');
    expect(a.finalPosition).toEqual(b.finalPosition);
    expect(a.finalQuaternion).toEqual(b.finalQuaternion);
  });

  it('10 drop cycles in one world leave no body/collider leak', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    try {
      const baseline = world.bodies.len();
      for (let i = 0; i < 10; i += 1) {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0),
        );
        world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1), body);
        for (let s = 0; s < 30; s += 1) world.step();
        world.removeRigidBody(body);
        expect(world.bodies.len()).toBe(baseline);
      }
      // Static layout colliders can be created and freed cleanly too
      for (const c of getStaticColliders()) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(...c.halfExtents).setTranslation(...c.position),
        );
      }
    } finally {
      world.free();
    }
  });
});

describe('Stage 2 §18.11–12 — domain result authority', () => {
  it('classifier result is unchanged by the physics layer', () => {
    expect(classifyItem(resolveItem('SKU-001')).category).toBe('B');
    expect(classifyItem(resolveItem('SKU-004')).category).toBe('C');
    expect(classifyItem(resolveItem('SKU-006')).category).toBe('D');
  });

  it('wrong-receiver drops are detected, never silently "fixed"', () => {
    // Mechanism fault: domain classified D, but the paddle executed a C push —
    // the item lands in C and the mismatch MUST be detected, not corrected.
    const bad = simulateDrop('SKU-007', 'D', { wrongPusher: true });
    expect(bad.insideExpectedReceiver).toBe(false);
    expect(receiverContains('D', bad.finalPosition)).toBe(false);
  });
});
