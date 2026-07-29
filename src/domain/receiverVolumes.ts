/**
 * Stage 2 — domain-decided receiver volumes (single source of truth).
 *
 * Used by the runtime physics handoff (PhysicalPlaybackItemPhysics) and the
 * headless validation sim (physicsDropSim) to verify that a settled body
 * landed in the receiver the DOMAIN classifier chose (Stage 2 §11.7).
 * The classifier result is never influenced by physics — this only verifies.
 */

import { ZONES, B_RECEIVER, ROLL_CAGE } from './physicalLayout';

export type ReceiverZone = 'B' | 'C' | 'D';

export function receiverContains(zone: ReceiverZone, p: [number, number, number]): boolean {
  const [x, y, z] = p;
  if (y < 0.01 || y > 1.2) return false;
  if (zone === 'B') {
    const b = B_RECEIVER;
    return Math.abs(x - b.centerX) <= b.width / 2 + 0.05 && Math.abs(z - b.centerZ) <= b.depth / 2 + 0.05;
  }
  const cage = zone === 'C' ? ZONES.C : ZONES.D;
  return Math.abs(x - cage.x) <= ROLL_CAGE.width / 2 + 0.05
    && Math.abs(z - cage.z) <= ROLL_CAGE.depth / 2 + 0.05;
}
