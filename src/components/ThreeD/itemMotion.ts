import type { Category, MachineState, SimulationState } from '../../domain/types';
import {
  CATEGORY_COLORS,
  DETAILS_TWIN_LAYOUT,
} from '../../domain/layout/sharedLayout';

/**
 * Details-twin layout — derived from shared physical constants
 * (belt height, zone X/Z, sensors, gate) so `/details` matches continuous scale.
 */
export const TWIN_LAYOUT = DETAILS_TWIN_LAYOUT;

export const ROUTE_COLORS: Record<Category, string> = {
  B: CATEGORY_COLORS.B,
  C: CATEGORY_COLORS.C,
  D: CATEGORY_COLORS.D,
};

export function progressForState(state: MachineState, elapsedMs: number): number {
  const ratios: Partial<Record<MachineState, [number, number, number]>> = {
    MOVING_TO_CAMERA: [0.06, 0.34, 1200],
    DETECTING: [0.34, 0.36, 900],
    MOVING_TO_GATE: [0.36, 0.64, 1300],
    WAITING_AT_GATE: [0.64, 0.65, 800],
    CLASSIFYING: [0.65, 0.66, 700],
    ROUTE_TO_B: [0.66, 0.93, 1200],
    ROUTE_TO_C: [0.66, 0.82, 1200],
    ROUTE_TO_D: [0.66, 0.82, 1200],
    RETURN_HOME: [0.93, 0.94, 700],
  };

  const segment = ratios[state];
  if (!segment) {
    return state === 'IDLE' ? 0.04 : 0.65;
  }

  const [from, to, duration] = segment;
  return from + (to - from) * Math.min(elapsedMs / duration, 1);
}

export function itemPosition3D(simulation: SimulationState): [number, number, number] {
  const progress = progressForState(simulation.machineState, simulation.elapsedInStateMs);
  const x = TWIN_LAYOUT.startX + progress * (TWIN_LAYOUT.endX - TWIN_LAYOUT.startX);
  const y = TWIN_LAYOUT.beltY + 0.12;
  let z = 0;

  if (simulation.machineState === 'ROUTE_TO_C') {
    z = Math.min(simulation.elapsedInStateMs / 1200, 1) * TWIN_LAYOUT.zoneCZ;
  } else if (simulation.machineState === 'ROUTE_TO_D') {
    z = -Math.min(simulation.elapsedInStateMs / 1200, 1) * Math.abs(TWIN_LAYOUT.zoneDZ);
  }

  return [x, y, z];
}

export function pusherOffset(state: 'idle' | 'extended' | 'retracting'): number {
  if (state === 'extended') return 0.55;
  if (state === 'retracting') return 0.25;
  return 0;
}

/**
 * Motion layer is state-machine driven (no physics engine).
 * Future physics integration can replace this module with kinematic bodies.
 */
export const PHYSICS_ENGINE_ENABLED = false;
