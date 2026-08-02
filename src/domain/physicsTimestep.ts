/** Shared fixed physics timestep — runtime Rapier and headless must match. */
export const PHYSICS_TIMESTEP_SEC = 1 / 120;
export const PHYSICS_MAX_SUBSTEPS = 4;
/** Clamp tab-return / stall spikes before they enter the fixed-step accumulator. */
export const MAX_FRAME_DELTA_SEC = 1 / 15;
export const PHYSICS_GRAVITY: [number, number, number] = [0, -9.81, 0];
