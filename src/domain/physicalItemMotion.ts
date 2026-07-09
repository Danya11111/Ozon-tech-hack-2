import { Category, DimensionsMm } from './types';
import {
  CONVEYOR_SPEED_MPS,
  BELT_TOP_Y,
  ZONES,
  ROLL_CAGE,
} from './physicalLayout';
import { CASE_PHASES } from './continuousPlayback';

export type SurfaceType = "belt" | "chute_c" | "chute_d" | "b_line" | "c_cage" | "d_cage";
export type MotionPhase = "feed" | "inspection" | "decision" | "routing" | "settled";

export interface PhysicalItemPose {
  position: [number, number, number];
  rotation: [number, number, number];
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

export function getPhysicalItemPose(input: PoseInput): PhysicalItemPose {
  const { dimensionsMm, targetCategory, elapsedMs, slotIndex = 0 } = input;
  const category = targetCategory || 'B';
  const itemHeightM = dimensionsMm.height / 1000;
  const beltY = BELT_TOP_Y + itemHeightM / 2;

  // Reconstruct phase start times from CASE_PHASES
  let cumulativeMs = 0;
  const starts: Record<string, number> = {};
  for (const p of CASE_PHASES) {
    starts[p.phase] = cumulativeMs;
    cumulativeMs += p.durationMs;
  }
  const totalDuration = cumulativeMs; // 9800

  // Fallback safe defaults
  let posX: number = ZONES.A.x;
  let posY = beltY;
  let posZ = 0;
  let rotY = 0;
  let surface: SurfaceType = 'belt';
  let phase: MotionPhase = 'feed';
  let isSettled = false;

  if (elapsedMs <= starts['move_to_detection']) {
    phase = 'feed';
    posX = ZONES.A.x;
  } else if (elapsedMs <= starts['detection']) {
    phase = 'feed';
    const dt = (elapsedMs - starts['move_to_detection']) / 1000;
    posX = ZONES.A.x + dt * CONVEYOR_SPEED_MPS;
  } else if (elapsedMs <= starts['measurement']) {
    phase = 'inspection';
    posX = ZONES.CAMERA.x;
  } else if (elapsedMs <= starts['routing']) {
    phase = 'decision';
    // Total movement time in this block: measurement (1000), classification (1000), command_sent (1000)
    // Distance from CAMERA to GATE = 1.5 - (-1.5) = 3.0m at 1m/s = 3000ms.
    const dt = (elapsedMs - starts['measurement']) / 1000;
    posX = ZONES.CAMERA.x + dt * CONVEYOR_SPEED_MPS;
  } else {
    // Routing, exit, clear_gap, or settled
    const routingStart = starts['routing'];
    const routingDuration = CASE_PHASES.find(p => p.phase === 'routing')!.durationMs; // 2500
    
    if (category === 'B') {
      const dt = (elapsedMs - routingStart) / 1000;
      posX = Math.min(ZONES.GATE.x + dt * CONVEYOR_SPEED_MPS, ZONES.B.x);
      surface = 'b_line';
      if (posX >= ZONES.B.x) {
        phase = 'settled';
        isSettled = elapsedMs >= totalDuration;
      } else {
        phase = 'routing';
      }
    } else {
      // C or D
      const isC = category === 'C';
      const targetZ = isC ? ZONES.C.z : ZONES.D.z;
      const targetX = isC ? ZONES.C.x : ZONES.D.x;
      
      const t = Math.max(0, Math.min((elapsedMs - routingStart) / routingDuration, 1.0));
      
      if (t < 1.0) {
        phase = 'routing';
        surface = isC ? 'chute_c' : 'chute_d';
        
        // Slide down the chute
        posX = ZONES.GATE.x + (targetX - ZONES.GATE.x) * t;
        posZ = targetZ * t;
        
        // Y drops from belt to cage floor
        const cageFloorY = 0.1; // approximate from ROLL_CAGE
        const targetY = cageFloorY + itemHeightM / 2;
        posY = beltY - (beltY - targetY) * (t * t); // slight ease-in
        
        // Slight rotation to face chute
        const angle = Math.atan2(targetZ, targetX - ZONES.GATE.x);
        rotY = -angle * t; 
      } else {
        phase = 'settled';
        isSettled = elapsedMs >= totalDuration;
        surface = isC ? 'c_cage' : 'd_cage';
        
        // Inside cage. Slot index offset to prevent perfect overlap.
        const cageCenterX = targetX;
        const cageCenterZ = targetZ;
        const cageFloorY = 0.1;
        
        // Deterministic offset based on slotIndex
        // Cage size is 1.2 x 0.8
        const offsetX = ((slotIndex % 3) - 1) * 0.2;
        const offsetZ = ((Math.floor(slotIndex / 3) % 2) - 0.5) * 0.2;
        
        posX = cageCenterX + offsetX;
        posZ = cageCenterZ + offsetZ;
        posY = cageFloorY + itemHeightM / 2;
        
        // Final scattered rotation
        rotY = (slotIndex * 45) * Math.PI / 180;
      }
    }
  }

  // If case is entirely finished, force settled
  if (elapsedMs >= totalDuration && phase !== 'settled') {
    isSettled = true;
    phase = 'settled';
  }

  return {
    position: [posX, posY, posZ],
    rotation: [0, rotY, 0],
    surface,
    phase,
    isSettled,
    activeRoute: category,
  };
}
