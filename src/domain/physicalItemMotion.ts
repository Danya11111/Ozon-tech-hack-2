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
import { B_RECEIVER, CAGE_FLOOR_Y, ROLL_CAGE } from './physicalLayout';

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

/** Deterministic slot position inside a cage (grid, stays within bounds). */
function cageSlot(name: SurfaceName, slotIndex: number, itemHeightM: number): { pos: Vec3; rotY: number } {
  const b = SURFACES[name].bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  // 3 columns × 2 rows grid inside the cage footprint.
  const col = slotIndex % 3;       // 0,1,2
  const row = Math.floor(slotIndex / 3) % 2; // 0,1
  const offsetX = (col - 1) * (ROLL_CAGE.width / 3.2); // ~±0.375
  const offsetZ = (row - 0.5) * (ROLL_CAGE.depth / 2.4); // ~±0.17
  return {
    pos: [cx + offsetX, CAGE_FLOOR_Y + itemHeightM / 2, cz + offsetZ],
    rotY: (slotIndex % 4) * (Math.PI / 8), // small fixed yaw variety, deterministic
  };
}

/** Deterministic rest position inside the B receiver tray (stacks backwards). */
function bReceiverSlot(slotIndex: number, itemHeightM: number): { pos: Vec3; rotY: number } {
  const spacing = 0.55;
  let x = B_RECEIVER.restX - (slotIndex % 4) * spacing;
  if (x < B_RECEIVER.startX + 0.3) x = B_RECEIVER.startX + 0.3;
  return {
    pos: [x, B_RECEIVER.y + itemHeightM / 2, 0],
    rotY: 0,
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
    // B: travel along the receiving tray, then rest inside it.
    const travelSpan = clearStart - routingStart;
    const t = (elapsedMs - routingStart) / travelSpan;
    if (t < 1) {
      const r = poseOnSurface('b_receiver', t, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'b_receiver'; phase = 'routing';
    } else {
      const r = bReceiverSlot(slotIndex, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'b_receiver'; phase = 'settled';
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
      const r = cageSlot(cageName, slotIndex, itemHeightM);
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
