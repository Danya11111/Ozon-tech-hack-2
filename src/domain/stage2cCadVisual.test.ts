/**
 * Stage 2C — CAD assembly params + runtime/headless physics hash.
 * Updated for active conveyor-clean.glb + CAD diverter vane extents.
 */
import { describe, expect, it } from 'vitest';
import {
  CAD_ASSEMBLY_PARAMS,
  CAD_TRANSFORM_MANIFEST,
  CAD_ROLLER_PITCH_M,
  CAD_CONVEYOR_WIDTH_M,
  CAD_BELT_HEIGHT_M,
} from './cadAssemblyParams';
import {
  assertRuntimeHeadlessParity,
  PHYSICS_TIMESTEP_SEC,
  buildPhysicsConfigSnapshot,
} from './physicsConfigHash';
import { SIM_DT } from './physicsDropSim';
import { GATE_VANE } from './pusherMotion';
import conveyorSource from '../components/ThreeD/ConveyorCadModel.tsx?raw';

describe('Stage 2C CAD assembly params', () => {
  it('preserves official belt width and height', () => {
    expect(CAD_CONVEYOR_WIDTH_M).toBe(0.5);
    expect(CAD_BELT_HEIGHT_M).toBe(0.7);
    expect(CAD_ASSEMBLY_PARAMS.rollerPitch).toBe(CAD_ROLLER_PITCH_M);
  });

  it('documents motor on-frame AABB (not under floor)', () => {
    const aabb = CAD_TRANSFORM_MANIFEST.motorWorldAabbApprox;
    expect(aabb.min[1]).toBeGreaterThan(0.4);
    expect(aabb.max[1]).toBeLessThan(0.8);
  });

  it('runtime loads conveyor-clean.glb as the sole conveyor asset URL', () => {
    expect(conveyorSource).toMatch(
      /CONVEYOR_CAD_URL\s*=\s*['"]\/models\/sorter\/conveyor-clean\.glb['"]/,
    );
    const urls = [...conveyorSource.matchAll(/['"]\/models\/sorter\/[^'"]+['"]/g)].map((m) => m[0]);
    expect(urls.every((u) => u.includes('conveyor-clean.glb'))).toBe(true);
  });
});

describe('Stage 2C runtime/headless physics parity', () => {
  it('headless SIM_DT matches canonical timestep', () => {
    expect(SIM_DT).toBe(PHYSICS_TIMESTEP_SEC);
  });

  it('hashes match for runtime and headless snapshots', () => {
    const parity = assertRuntimeHeadlessParity(SIM_DT);
    expect(parity.timestepEqual).toBe(true);
    expect(parity.equal).toBe(true);
    expect(parity.runtime).toBe(parity.headless);
    expect(parity.runtime).toMatch(/^[a-f0-9]{16}$/);
  });

  it('snapshot includes static colliders and current CAD vane geometry', () => {
    const snap = buildPhysicsConfigSnapshot(PHYSICS_TIMESTEP_SEC);
    expect(snap.staticColliderCount).toBeGreaterThan(5);
    expect(snap.pusherHalfExtents).toEqual([...GATE_VANE.halfExtents]);
    expect(snap.gravity).toEqual([0, -9.81, 0]);
  });
});
