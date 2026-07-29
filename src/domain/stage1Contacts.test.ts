/**
 * Stage 1 — physical contact contracts.
 *
 * Verifies the bottom-contact guarantee for real models:
 *   - continuous scene: pose center = surfaceY + h/2, mesh bottom-center pivot
 *     offset −h/2 → model bottom touches the surface exactly (epsilon 0).
 *   - details scene: itemPosition3D y == beltY (bottom-contact semantics,
 *     no 12cm float, no 2.5x visual multiplier).
 */
import { describe, it, expect } from 'vitest';
import { getPhysicalItemPose } from './physicalItemMotion';
import { BELT_TOP_Y, CAGE_FLOOR_Y } from './physicalLayout';
import { itemPosition3D, TWIN_LAYOUT } from '../components/ThreeD/itemMotion';
import { ITEMS } from '../data/items';
import type { SimulationState } from './types';

describe('Stage 1 belt/cage contact contracts', () => {
  const box = ITEMS.find((i) => i.id === 'SKU-001')!;

  it('item center on main belt is surfaceY + h/2 (bottom touches with bottom-center pivot)', () => {
    const pose = getPhysicalItemPose({
      caseId: 'case-001',
      dimensionsMm: box.dimensionsMm,
      targetCategory: 'B',
      elapsedMs: 500, // feed phase
    });
    const itemHeightM = box.dimensionsMm.height / 1000;
    expect(pose.surface).toBe('main_belt');
    expect(pose.position[1]).toBeCloseTo(BELT_TOP_Y + itemHeightM / 2, 6);
    // bottom-center pivot at −h/2 → bottom at BELT_TOP_Y (contact epsilon = 0)
    expect(pose.position[1] - itemHeightM / 2).toBeCloseTo(BELT_TOP_Y, 6);
  });

  it('settled item in C cage rests on the cage floor, not through it', () => {
    const pose = getPhysicalItemPose({
      caseId: 'case-004',
      slotIndex: 0,
      dimensionsMm: box.dimensionsMm,
      targetCategory: 'C',
      elapsedMs: Number.MAX_SAFE_INTEGER / 4, // settled
    });
    const itemHeightM = box.dimensionsMm.height / 1000;
    expect(pose.surface).toBe('c_cage_floor');
    expect(pose.position[1] - itemHeightM / 2).toBeCloseTo(CAGE_FLOOR_Y, 6);
  });

  it('details scene uses bottom-contact belt height (no visual float)', () => {
    const sim = { machineState: 'IDLE', elapsedInStateMs: 0 } as SimulationState;
    const [, y] = itemPosition3D(sim);
    expect(y).toBeCloseTo(TWIN_LAYOUT.beltY, 6);
    expect(y).toBeCloseTo(BELT_TOP_Y, 6);
  });

  it('details scene has no VISUAL_SCALE_MULTIPLIER distortion (true physical scale)', async () => {
    // Static guard: the multiplier must not be reintroduced.
    const source = await import('../components/ThreeD/Item3D.tsx?raw');
    expect(source.default).not.toMatch(/VISUAL_SCALE_MULTIPLIER\s*=/);
    expect(source.default).toMatch(/getRenderedItemDimensions/);
  });
});
