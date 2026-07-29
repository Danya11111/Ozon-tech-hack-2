/**
 * Stage 2 — sorterVisualState adapter.
 *
 * Single mapping layer: domain playback state -> visual mechanism commands +
 * physics handoff. Business logic (classifier, playlist, phase machine) stays
 * the only source of truth; this adapter NEVER decides categories or routes —
 * it projects domain decisions into beltVelocity / gate / pusher / physics
 * authority for the 3D layer (mirrors the playbackToSimulation pattern).
 */

import type { Category } from './types';
import type { CasePhase, ContinuousPlaybackState } from './continuousPlayback';
import { CONVEYOR_SPEED_MPS } from './physicalLayout';

export type GatePhase = 'closed' | 'hold-open';
export type ScanState = 'idle' | 'detecting' | 'measuring';
export type AlarmState = 'none' | 'fault' | 'estop';
export type ItemAuthority = 'domain' | 'physics';

export interface SorterVisualState {
  /** Belt linear velocity m/s (0 when paused/fault/e-stop). */
  beltVelocityMps: number;
  /** Roller angular velocity rad/s = v / r (r = 25 mm CAD roller). */
  rollerOmegaRadPerSec: number;
  /** Stop-gate / metering barrier state (CAD barriers on the junction). */
  gatePhase: GatePhase;
  gateOpen: boolean;
  /** Pusher/diverter servo command. */
  pusher: { active: boolean; category: Category | null };
  /** Measurement rig state for camera/laser visualization. */
  scanState: ScanState;
  alarmState: AlarmState;
  /** Domain-decided target (never physics-decided). */
  targetZone: Category | null;
  expectedLandingZone: 'B' | 'C' | 'D' | null;
  /**
   * Item authority: 'domain' while the item pose is kinematic
   * (getPhysicalItemPose), 'physics' after the drop handoff
   * (routing phase, on chute surface).
   */
  itemAuthority: ItemAuthority;
  /**
   * Case-time fraction within the routing phase at which authority
   * transfers to physics (pusher contact / belt edge). B: 0.35 (end of
   * b_transfer spur); C/D: 0.06 (pusher contact at gate exit).
   */
  dropHandoffFraction: number;
}

/** Phases in which the post-inspection metering gate is open (item released from inspection). */
const GATE_OPEN_PHASES: ReadonlySet<CasePhase> = new Set([
  'measurement', 'classification', 'command_sent', 'routing', 'exit', 'clear_gap', 'recover',
]);
const FAULT_PHASES: ReadonlySet<CasePhase> = new Set(['fault_hold', 'emergency_hold']);

export function deriveSorterVisualState(playback: ContinuousPlaybackState): SorterVisualState {
  const phase = playback.currentPhase;
  const category = playback.targetCategory;
  const running = playback.status === 'running';
  const fault = phase === 'fault_hold';
  const estop = phase === 'emergency_hold';
  const halted = !running || fault || estop || playback.currentCase.faultType != null && FAULT_PHASES.has(phase);

  const beltVelocity = halted ? 0 : CONVEYOR_SPEED_MPS * playback.speed;
  const gateOpen = !fault && !estop && GATE_OPEN_PHASES.has(phase);

  let itemAuthority: ItemAuthority = 'domain';
  let dropHandoffFraction = 1.1; // unreachable by default (no physics handoff)
  if (!playback.currentCase.faultType && phase === 'routing' && category) {
          dropHandoffFraction = category === 'B' ? 0.35 : 0.12;
    itemAuthority = 'physics';
  }

  return {
    beltVelocityMps: beltVelocity,
    rollerOmegaRadPerSec: beltVelocity / 0.025,
    gatePhase: gateOpen ? 'hold-open' : 'closed',
    gateOpen,
    pusher: {
      active: !fault && !estop && (phase === 'routing' || phase === 'exit') && (category === 'C' || category === 'D'),
      category: category === 'C' || category === 'D' ? category : null,
    },
    scanState: phase === 'detection' ? 'detecting' : phase === 'measurement' ? 'measuring' : 'idle',
    alarmState: estop ? 'estop' : fault ? 'fault' : 'none',
    targetZone: category,
    expectedLandingZone: category,
    itemAuthority,
    dropHandoffFraction,
  };
}

/** Case-time (ms) at which the current item is handed to physics, if any. */
export function dropHandoffCaseTimeMs(playback: ContinuousPlaybackState, phaseStarts: Record<string, number>, routingDurationMs: number): number | null {
  const vs = deriveSorterVisualState(playback);
  if (vs.dropHandoffFraction > 1) return null;
  const routingStart = phaseStarts['routing'];
  if (routingStart == null) return null;
  return routingStart + vs.dropHandoffFraction * routingDurationMs;
}
