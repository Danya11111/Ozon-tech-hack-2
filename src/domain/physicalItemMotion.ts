/**
 * Physical Item Motion — детерминированная поза товара.
 *
 * ЕДИНСТВЕННЫЙ источник движения товара. Вся геометрия берётся из conveyorNetwork.
 * Поза считается только от elapsedMs (время внутри кейса). Нет рандома,
 * нет покадровых инкрементов, нет отдельной "скорости товара".
 */

import type { Category, DimensionsMm } from './types';
import type { FaultType } from './demoPlaylist';
import { CASE_PHASES, JAM_CASE_PHASES, ESTOP_CASE_PHASES } from './continuousPlayback';
import {
  SURFACES,
  lerp3,
  surfaceHeading,
  type SurfaceName,
  type Vec3,
} from './conveyorNetwork';
import { ZONES, CONVEYOR_SPEED_MPS, CAD_GATE_ENGAGE_X } from './physicalLayout';
import { SCAN_START_X, SCAN_END_X } from './measurementZone';

export type SurfaceType = SurfaceName;
export type MotionPhase = 'feed' | 'inspection' | 'decision' | 'routing' | 'settled' | 'fault' | 'recover';

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
  faultType?: FaultType;
  /** Optional seeded visual jitter (meters / radians). */
  jitter?: { x: number; z: number; yaw: number };
}

/** Cumulative phase start times from a phase table. */
function phaseStartsFrom(phases: typeof CASE_PHASES) {
  let cumulative = 0;
  const starts: Record<string, number> = {};
  for (const p of phases) {
    starts[p.phase] = cumulative;
    cumulative += p.durationMs;
  }
  return { starts, total: cumulative };
}

/** Pose for a point at parameter t (0..1) along a surface, item resting on top. */
function poseOnSurface(name: SurfaceName, t: number, itemHeightM: number): { pos: Vec3; rotY: number } {
  const s = SURFACES[name];
  const p = lerp3(s.start, s.end, t);
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
  const col = slotIndex % 3;
  const row = Math.floor(slotIndex / 3) % 2;
  const offsetX = (col - 1) * (spanX / 3.5);
  const offsetZ = (row - 0.5) * (spanZ / 3.0);
  return {
    pos: [cx + offsetX, s.surfaceY + itemHeightM / 2, cz + offsetZ],
    rotY: (slotIndex % 4) * (Math.PI / 8),
  };
}

function applyJitter(pos: Vec3, rotY: number, jitter?: PoseInput['jitter']): { pos: Vec3; rotY: number } {
  if (!jitter) return { pos, rotY };
  return {
    pos: [pos[0] + jitter.x, pos[1], pos[2] + jitter.z],
    rotY: rotY + jitter.yaw,
  };
}

/**
 * Stage 2 — case time (ms within case) at which the item is handed from
 * kinematic authority to rigid-body physics:
 *  - B: fraction 0.35 of the B travel span (end of b_transfer spur — the
 *    item physically loses belt support at the real spur edge);
 *  - C/D: routing start — the item is at the junction (belt center over the
 *    gate), where the cross-belt pusher engages it. The pusher kinematic
 *    body then physically CONTACTS the item and drives it onto the chute
 *    (Stage 2B §13: no timer-only teleport into the chute);
 *  - fault cases: null (no physics handoff — domain fault pose is truth).
 */
export function getDropHandoffTimeMs(
  targetCategory: Category | null,
  faultType?: FaultType,
): number | null {
  if (faultType) return null;
  const category: 'B' | 'C' | 'D' = (targetCategory as 'B' | 'C' | 'D') || 'B';
  const { starts } = phaseStartsFrom(CASE_PHASES);
  const routingStart = starts['routing'];
  if (category === 'B') {
    const exitStart = starts['exit'];
    return routingStart + 0.35 * (exitStart - routingStart);
  }
  // C/D: become dynamic at CAD vane engage X so open gates can deflect the item.
  // (Domain GATE.x is further downstream for the B exit spur.)
  const feedStart = starts['move_to_detection'];
  const travelM = CAD_GATE_ENGAGE_X - ZONES.A.x;
  return feedStart + (travelM / CONVEYOR_SPEED_MPS) * 1000;
}

/** Case-time (ms) at which the routing phase begins (drives the paddle timeline). */
export function getRoutingStartMs(): number {
  const { starts } = phaseStartsFrom(CASE_PHASES);
  return starts['routing'];
}

/** Jam / E-stop motion: freeze at junction, then recover (no settle into bin). */
function getFaultPose(input: PoseInput): PhysicalItemPose {
  const { dimensionsMm, elapsedMs, faultType, jitter } = input;
  const itemHeightM = dimensionsMm.height / 1000;
  const phases = faultType === 'emergency_stop' ? ESTOP_CASE_PHASES : JAM_CASE_PHASES;
  const { starts, total } = phaseStartsFrom(phases);

  const feedStart = starts['move_to_detection'] ?? 0;
  const inspectStart = starts['detection'] ?? feedStart;
  const measureStart = starts['measurement'] ?? inspectStart;
  const classifyStart = starts['classification'] ?? measureStart;
  const faultStart =
    starts['fault_hold'] ?? starts['emergency_hold'] ?? classifyStart;
  const recoverStart = starts['recover'] ?? faultStart;
  const clearStart = starts['clear_gap'] ?? recoverStart;

  let pos: Vec3;
  let rotY = 0;
  let surface: SurfaceType = 'main_belt';
  let phase: MotionPhase = 'feed';

  if (elapsedMs <= feedStart) {
    const r = poseOnSurface('main_belt', 0, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'main_belt'; phase = 'feed';
  } else if (elapsedMs <= inspectStart) {
    const t = (elapsedMs - feedStart) / Math.max(inspectStart - feedStart, 1);
    const r = poseOnSurface('main_belt', t, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'main_belt'; phase = 'feed';
  } else if (elapsedMs <= faultStart) {
    // Hold under inspection / approach gate
    const r = poseOnSurface('inspection_station', 0.4, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'inspection_station'; phase = 'inspection';
  } else if (elapsedMs <= recoverStart) {
    // Freeze at routing junction (jam / e-stop visual)
    const r = poseOnSurface('routing_junction', 0.35, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'routing_junction'; phase = 'fault';
  } else if (elapsedMs <= clearStart) {
    // Slight reverse toward belt for recovery narrative
    const t = (elapsedMs - recoverStart) / Math.max(clearStart - recoverStart, 1);
    const r = poseOnSurface('routing_junction', 0.35 * (1 - t * 0.5), itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'routing_junction'; phase = 'recover';
  } else {
    const r = poseOnSurface('main_belt', 0.15, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'main_belt'; phase = 'recover';
  }

  const j = applyJitter(pos, rotY, jitter);
  if (!Number.isFinite(j.pos[0]) || !Number.isFinite(j.pos[1]) || !Number.isFinite(j.pos[2])) {
    j.pos = [SURFACES.main_belt.start[0], SURFACES.main_belt.surfaceY + itemHeightM / 2, 0];
  }

  return {
    position: j.pos,
    rotation: [0, j.rotY, 0],
    surface,
    phase,
    isSettled: elapsedMs >= total && false,
    activeRoute: (input.targetCategory as 'B' | 'C' | 'D') || 'B',
  };
}

export function getPhysicalItemPose(input: PoseInput): PhysicalItemPose {
  if (input.faultType) {
    return getFaultPose(input);
  }

  const { dimensionsMm, targetCategory, elapsedMs, slotIndex = 0, jitter } = input;
  const category: 'B' | 'C' | 'D' = (targetCategory as 'B' | 'C' | 'D') || 'B';
  const itemHeightM = dimensionsMm.height / 1000;

  const { starts, total } = phaseStartsFrom(CASE_PHASES);
  const feedStart = starts['move_to_detection'];
  const routingStart = starts['routing'];
  const clearStart = starts['clear_gap'];

  let pos: Vec3;
  let rotY = 0;
  let surface: SurfaceType;
  let phase: MotionPhase;
  let isSettled = false;

  if (elapsedMs <= feedStart) {
    const r = poseOnSurface('main_belt', 0, itemHeightM);
    pos = r.pos; rotY = r.rotY; surface = 'main_belt'; phase = 'feed';
  } else if (elapsedMs <= routingStart) {
    // Stage 2B §10–12: CONTINUOUS belt travel at constant conveyor speed —
    // no dwell under the camera. Phase timing (move_to_detection 1900 ms +
    // detection 600 + measurement 1000 + classification 1000 + command_sent
    // 1000 = 5500 ms) exactly matches A->GATE distance at 1.0 m/s, so the
    // item arrives at the mechanism engagement point exactly at routing start.
    const travelS = (elapsedMs - feedStart) / 1000;
    const x = Math.min(SURFACES.main_belt.start[0] + CONVEYOR_SPEED_MPS * travelS, ZONES.GATE.x);
    if (x <= ZONES.CAMERA.x) {
      const t = (x - SURFACES.main_belt.start[0]) / (SURFACES.main_belt.end[0] - SURFACES.main_belt.start[0]);
      const r = poseOnSurface('main_belt', t, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'main_belt';
    } else {
      const t = (x - ZONES.CAMERA.x) / (ZONES.GATE.x - ZONES.CAMERA.x);
      const r = poseOnSurface('routing_junction', t, itemHeightM);
      pos = r.pos; rotY = r.rotY; surface = 'routing_junction';
    }
    phase = x < SCAN_START_X ? 'feed' : x <= SCAN_END_X ? 'inspection' : 'decision';
  } else if (category === 'B') {
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

  const j = applyJitter(pos, rotY, jitter);
  if (!Number.isFinite(j.pos[0]) || !Number.isFinite(j.pos[1]) || !Number.isFinite(j.pos[2])) {
    j.pos = [SURFACES.main_belt.start[0], SURFACES.main_belt.surfaceY + itemHeightM / 2, 0];
  }

  return {
    position: j.pos,
    rotation: [0, j.rotY, 0],
    surface,
    phase,
    isSettled,
    activeRoute: category,
  };
}
