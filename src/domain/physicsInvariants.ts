/**
 * Physics / motion invariants for deterministic kinematic demo.
 */

import type { PhysicalItemPose } from './physicalItemMotion';
import type { ContinuousPlaybackState } from './continuousPlayback';

export interface PhysicsInvariantResult {
  ok: boolean;
  violations: string[];
}

const MAX_TELEPORT_M_PER_S = 3.5;

export function checkPoseContinuity(
  prev: PhysicalItemPose | null,
  next: PhysicalItemPose,
  dtSec: number,
): PhysicsInvariantResult {
  const violations: string[] = [];
  if (!prev || dtSec <= 0) return { ok: true, violations };

  const dist = Math.hypot(
    next.position[0] - prev.position[0],
    next.position[1] - prev.position[1],
    next.position[2] - prev.position[2],
  );
  const speed = dist / dtSec;

  if (
    speed > MAX_TELEPORT_M_PER_S &&
    prev.phase === next.phase &&
    next.phase !== 'settled'
  ) {
    violations.push(`teleport_speed=${speed.toFixed(2)}m/s`);
  }

  if (!Number.isFinite(next.position[0]) || !Number.isFinite(next.position[1])) {
    violations.push('non_finite_position');
  }

  return { ok: violations.length === 0, violations };
}

export function checkFrozenOnFault(
  playback: ContinuousPlaybackState,
  prev: PhysicalItemPose | null,
  next: PhysicalItemPose,
): PhysicsInvariantResult {
  const violations: string[] = [];
  const frozen =
    playback.currentPhase === 'fault_hold' || playback.currentPhase === 'emergency_hold';
  if (!frozen || !prev) return { ok: true, violations };

  const dist = Math.hypot(
    next.position[0] - prev.position[0],
    next.position[1] - prev.position[1],
    next.position[2] - prev.position[2],
  );
  if (dist > 0.02) {
    violations.push(`moved_during_fault dist=${dist.toFixed(3)}`);
  }
  return { ok: violations.length === 0, violations };
}

export function checkRouteMatchesClass(
  playback: ContinuousPlaybackState,
  pose: PhysicalItemPose,
): PhysicsInvariantResult {
  const violations: string[] = [];
  if (!playback.classification) return { ok: true, violations };
  if (playback.currentPhase !== 'routing' && playback.currentPhase !== 'exit') {
    return { ok: true, violations };
  }
  if (playback.currentCase.faultType) return { ok: true, violations };
  if (pose.activeRoute !== playback.classification.category) {
    violations.push(
      `route_mismatch pose=${pose.activeRoute} class=${playback.classification.category}`,
    );
  }
  return { ok: violations.length === 0, violations };
}

export function evaluatePhysicsInvariants(
  playback: ContinuousPlaybackState,
  prev: PhysicalItemPose | null,
  next: PhysicalItemPose,
  dtSec: number,
): PhysicsInvariantResult {
  const parts = [
    checkPoseContinuity(prev, next, dtSec),
    checkFrozenOnFault(playback, prev, next),
    checkRouteMatchesClass(playback, next),
  ];
  const violations = parts.flatMap((p) => p.violations);
  return { ok: violations.length === 0, violations };
}

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export { MAX_TELEPORT_M_PER_S };
