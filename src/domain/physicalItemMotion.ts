/**
 * Physical Item Motion — детерминированная поза товара.
 *
 * ЕДИНСТВЕННЫЙ источник движения товара. Вся геометрия берётся из conveyorNetwork.
 * Поза считается только от elapsedMs (время внутри кейса). Нет рандома,
 * нет покадровых инкрементов, нет отдельной "скорости товара".
 */

import type { Category, DimensionsMm } from './types';
import { CASE_PHASES } from './continuousPlayback';
import {
  SURFACES,
  lerp3,
  surfaceHeading,
  type SurfaceName,
  type Vec3,
} from './conveyorNetwork';

export type SurfaceType = SurfaceName;
export type MotionPhase = 'feed' | 'inspection' | 'decision' | 'routing' | 'settled';

export interface PhysicalItemPose {
  position: Vec3;
  rotation: Vec3;
  surface: SurfaceType;
  phase: MotionPhase;
  isSettled: boolean;
  activeRoute: 'B' | 'C' | 'D';
}

export interface PoseInput {
  caseId: string;
  slotIndex?: number;
  dimensionsMm: DimensionsMm;
  targetCategory: Category | null;
  elapsedMs: number;
}

/** Cumulative phase start times reconstructed once from CASE_PHASES. */
function phaseStarts() {
  let cumulative = 0;
  const starts: Record<string, number> = {};
  for (const p of CASE_PHASES) {
    starts[p.phase] = cumulative;
    cumulative += p.durationMs;
  }
  return { starts, total: cumulative };
}

/** Pose for a point at parameter t (0..1) along a surface, item resting on top. */
function poseOnSurface(name: SurfaceName, t: number, itemHeightM: number): { pos: Vec3; rotY: number } {
  const s = SURFACES[name];
  const p = lerp3(s.start, s.end, t);
  // Item bottom sits on the surface: center = surfaceTop + half height.
  return {
    pos: [p[0], p[1] + itemHeightM / 2, p[2]],
    rotY: surfaceHeading(name),
  };
}

/**
 * Deterministic settled slot inside any bin/cage floor surface.
 * Uses the surface's own bounds so items always stay contained (grid 3×2).
 */
function settledSlot(name: SurfaceName, slotIndex: number, itemHeightM: number): { pos: Vec3; rotY: number } {
  const s = SURFACES[name];
  const b = s.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const spanX = b.maxX - b.minX;
  const spanZ = b.maxZ - b.minZ;
  const col = slotIndex % 3;                 // 0,1,2
  const row = Math.floor(slotIndex / 3) % 2; // 0,1
  const offsetX = (col - 1) * (spanX / 3.5); // stays well within bounds
  const offsetZ = (row - 0.5) * (spanZ / 3.0);
  return {
    pos: [cx + offsetX, s.surfaceY + itemHeightM / 2, cz + offsetZ],
    rotY: (slotIndex % 4) * (Math.PI / 8),
  };
}

export function getPhysicalItemPose(input: PoseInput): PhysicalItemPose {
  const { dimensionsMm, targetCategory, elapsedMs, slotIndex = 0 } = input;
  const category: 'B' | 'C' | 'D' = (targetCategory as 'B' | 'C' | 'D') || 'B';
  const itemHeightM = dimensionsMm.height / 1000;

  const { starts, total } = phaseStarts();
  const feedStart = starts['move_to_detection'];
  const inspectStart = starts['detection'];
  const junctionStart = starts['measurement'];
  const routingStart = starts['routing'];
  const clearStart = starts['clear_gap'];

  let pos: Vec3;
  let rotY = 0;
  let surface: SurfaceType;
  let phase: MotionPhase;
  let isSettled = false;

  if (elapsedMs <= feedStart) {
    // Spawn dwell at belt entry (A).
    const r = poseOnSurface('main_belt', 0, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'main_belt'; phase = 'feed';
  } else if (elapsedMs <= inspectStart) {
    // Feed along the main belt A → inspection.
    const t = (elapsedMs - feedStart) / (inspectStart - feedStart);
    const r = poseOnSurface('main_belt', t, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'main_belt'; phase = 'feed';
  } else if (elapsedMs <= junctionStart) {
    // Dwell under the inspection station.
    const r = poseOnSurface('inspection_station', 0, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'inspection_station'; phase = 'inspection';
  } else if (elapsedMs <= routingStart) {
    // Travel to the routing junction.
    const t = (elapsedMs - junctionStart) / (routingStart - junctionStart);
    const r = poseOnSurface('routing_junction', t, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'routing_junction'; phase = 'decision';
  } else if (category === 'B') {
    // B: short transfer spur → drop chute → settle inside floor bin.
    const exitStart = starts['exit'];
    const travelSpan = exitStart - routingStart;
    const t = (elapsedMs - routingStart) / travelSpan;
    if (t < 0.35) {
      const r = poseOnSurface('b_transfer', t / 0.35, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'b_transfer'; phase = 'routing';
    } else if (t < 0.88) {
      const r = poseOnSurface('chute_b', (t - 0.35) / 0.53, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'chute_b'; phase = 'routing';
    } else {
      const r = settledSlot('b_bin_floor', slotIndex, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'b_bin_floor'; phase = 'settled';
      isSettled = elapsedMs >= total;
    }
  } else {
    // C / D: slide down the chute, then settle on the cage floor.
    const chuteName: SurfaceName = category === 'C' ? 'chute_c' : 'chute_d';
    const cageName: SurfaceName = category === 'C' ? 'c_cage_floor' : 'd_cage_floor';
    const travelSpan = clearStart - routingStart;
    const t = (elapsedMs - routingStart) / travelSpan;
    if (t < 1) {
      const r = poseOnSurface(chuteName, t, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = chuteName; phase = 'routing';
    } else {
      const r = settledSlot(cageName, slotIndex, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = cageName; phase = 'settled';
      isSettled = elapsedMs >= total;
    }
  }

  // Guarantee no NaN/Infinity escapes.
  if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[1]) || !Number.isFinite(pos[2])) {
    pos = [SURFACES.main_belt.start[0], SURFACES.main_belt.surfaceY + itemHeightM / 2, 0];
  }

  return {
    position: pos,
    rotation: [0, rotY, 0],
    surface,
    phase,
    isSettled,
    activeRoute: category,
  };
}
