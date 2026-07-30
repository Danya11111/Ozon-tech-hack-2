/**
 * Stage 2B §13 — angled paddle diverter (sorting mechanism) motion model.
 *
 * Pure domain timing module consumed by BOTH the runtime kinematic pusher
 * body and the headless validation sim — identical motion, identical contact.
 *
 * Physical design (real angled-paddle diverter):
 *  - The paddle is parked beside the belt upstream of the chute and sweeps
 *    DIAGONALLY (matching the domain junction->cage diagonal dx=0.5, dz=1.35,
 *    ≈20°) so items are driven toward the cage CENTER — a straight Z push
 *    would strand the 900mm carton against the cage west frame (engineering
 *    reality discovered via headless drop sims).
 *  - The plate travels over the belt/chute surface (plate bottom ~2mm above
 *    the belt) and physically CONTACTS the item. No timer-only teleport:
 *    the item becomes dynamic at the routing junction and the paddle drives
 *    it onto the gravity chute; gravity takes over below the plate reach.
 *
 * Timeline is keyed to case time (routing phase elapsed) — deterministic.
 */

import { BELT_TOP_Y } from './physicalLayout';

/** Pusher plate geometry (SPEC_DERIVED, matches visible Actuator3D plate). */
export const PUSHER = {
  /** Plate half extents [x, y, z] — 1000mm wide face across the junction. */
  halfExtents: [0.5, 0.14, 0.025] as [number, number, number],
  /** Plate center Y — bottom 2mm above the belt (no pinch against the
   *  belt slab; still sweeps items down to ~14mm tall). */
  centerY: BELT_TOP_Y + 0.142,
  /** Push direction (unit, XZ) — the junction->cage diagonal (0.5, 1.35). */
  dirX: 0.348,
  dirZ: 0.937,
  /** Paddle yaw so the face is perpendicular to the push direction. */
  yaw: Math.atan2(0.348, 0.937),
  /** Item engagement point (junction end / gate center). */
  engageX: 1.5,
  engageZ: 0,
  /** Distance behind the item where the paddle parks (along -dir). */
  homeDistance: 0.4,
  /** Stroke length: from park to deep at the cage mouth center (x≈2.0). */
  strokeLength: 1.62,
  /** Stroke speed m/s (pneumatic paddle class). */
  strokeSpeed: 1.0,
  /** Delay after routing start before the stroke begins. */
  armDelaySec: 0.15,
  /** Hold at full extension before retract. */
  holdSec: 0.15,
  /** Retract speed m/s. */
  retractSpeed: 2.0,
} as const;

export type PusherPhase = 'rest' | 'armed' | 'extending' | 'hold' | 'retracting';

export interface PusherState {
  active: boolean;
  category: 'C' | 'D' | null;
  phase: PusherPhase;
  /** Plate center (world). */
  x: number;
  z: number;
  /** Paddle yaw (world, rad about Y). */
  yaw: number;
  /** Instantaneous plate speed along the push direction (m/s, signed). */
  speed: number;
}

/**
 * Pusher state at `routingElapsedSec` seconds after the routing phase began.
 * `category` is the DOMAIN routing decision (source of truth).
 */
export function getPusherState(
  category: 'B' | 'C' | 'D' | null,
  routingElapsedSec: number,
): PusherState {
  if (category !== 'C' && category !== 'D') {
    return { active: false, category: null, phase: 'rest', x: PUSHER.engageX, z: 0, yaw: 0, speed: 0 };
  }
  const zSign = category === 'C' ? 1 : -1;
  const dx = PUSHER.dirX;
  const dz = PUSHER.dirZ * zSign;
  const yaw = PUSHER.yaw * zSign;
  const at = (s: number) => ({
    x: PUSHER.engageX + dx * s,
    z: PUSHER.engageZ + dz * s,
  });

  const strokeSec = PUSHER.strokeLength / PUSHER.strokeSpeed;
  const retractSec = (PUSHER.strokeLength + PUSHER.homeDistance) / PUSHER.retractSpeed;

  const t = routingElapsedSec - PUSHER.armDelaySec;
  if (t < 0) {
    const p = at(-PUSHER.homeDistance);
    return { active: true, category, phase: 'armed', ...p, yaw, speed: 0 };
  }
  if (t < strokeSec) {
    const p = at(-PUSHER.homeDistance + PUSHER.strokeSpeed * t);
    return { active: true, category, phase: 'extending', ...p, yaw, speed: PUSHER.strokeSpeed };
  }
  const tHold = t - strokeSec;
  if (tHold < PUSHER.holdSec) {
    const p = at(-PUSHER.homeDistance + PUSHER.strokeLength);
    return { active: true, category, phase: 'hold', ...p, yaw, speed: 0 };
  }
  const tRet = tHold - PUSHER.holdSec;
  if (tRet < retractSec) {
    const p = at(-PUSHER.homeDistance + PUSHER.strokeLength - PUSHER.retractSpeed * tRet);
    return { active: true, category, phase: 'retracting', ...p, yaw, speed: -PUSHER.retractSpeed };
  }
  const p = at(-PUSHER.homeDistance);
  return { active: true, category, phase: 'rest', ...p, yaw, speed: 0 };
}
