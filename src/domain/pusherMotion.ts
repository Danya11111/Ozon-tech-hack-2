/**
 * Swing diverter state machine (STRAIGHT / DIVERT_LEFT / DIVERT_RIGHT).
 *
 * Neutral = both 0° (parallel rails). Motion angles are relative hinge yaw
 * applied on top of a frozen neutral bind quaternion (see ConveyorCadModel).
 */

import { BELT_TOP_Y, CONVEYOR_SPEED_MPS, JUNCTION, ZONES } from './physicalLayout';
import { SCAN_END_X } from './measurementZone';

/** Canonical diverter command state. */
export type DiverterState = 'STRAIGHT' | 'DIVERT_LEFT' | 'DIVERT_RIGHT';

/** Compat alias used by older call sites. */
export type GateMode = 'STRAIGHT' | 'LEFT' | 'RIGHT';

export type DiverterPhase = 'READY' | 'OPENING' | 'HOLDING' | 'CLOSING';
/** @deprecated alias */
export type GatePhase = 'rest' | 'opening' | 'hold' | 'closing';

/** CAD barrier length / lateral span → signed reach yaw. */
const CAD_DIVERTER_LENGTH_M = 0.75;
const CAD_HINGE_LATERAL_SPAN_M =
  Math.abs(JUNCTION.leftPivot.z - JUNCTION.rightPivot.z);
const CAD_REACH_YAW_DEG =
  (Math.asin(Math.min(0.999, CAD_HINGE_LATERAL_SPAN_M / CAD_DIVERTER_LENGTH_M)) * 180) /
  Math.PI;

export const GATE_VANE = {
  halfExtents: [CAD_DIVERTER_LENGTH_M / 2, 0.05, 0.02] as [number, number, number],
  centerY: JUNCTION.leftPivot.y,
  /** Logical display magnitude (deg). */
  activeDeg: 45,
  /**
   * LEFT signed yaw (rad source via deg): free end toward −Z (across belt)
   * → physical LEFT exit. Logical 45°.
   */
  leftActiveYawDeg: -Math.min(45, CAD_REACH_YAW_DEG),
  /**
   * RIGHT signed yaw: free end toward +Z → physical RIGHT exit.
   */
  rightActiveYawDeg: Math.min(45, CAD_REACH_YAW_DEG),
  /** Demo angular speed (~0.33–0.50 s to 45°). */
  angularSpeedDegPerSec: 120,
  swingSec: 0.40,
  holdSec: 2.40,
  retractSec: 0.40,
  openLeadM: CONVEYOR_SPEED_MPS * 0.40 + 0.15 + 0.15,
} as const;

export function categoryToGateMode(category: 'B' | 'C' | 'D' | null): GateMode {
  if (category === JUNCTION.leftEntry.category) return 'LEFT';
  if (category === JUNCTION.rightEntry.category) return 'RIGHT';
  return 'STRAIGHT';
}

export function gateModeToDiverterState(mode: GateMode): DiverterState {
  if (mode === 'LEFT') return 'DIVERT_LEFT';
  if (mode === 'RIGHT') return 'DIVERT_RIGHT';
  return 'STRAIGHT';
}

export interface GateState {
  mode: GateMode;
  state: DiverterState;
  phase: DiverterPhase;
  /** Target hinge motion angles (rad), NOT pre-lerped display. */
  leftTargetRad: number;
  rightTargetRad: number;
  /** Compat: same as targets (visual interpolates separately). */
  leftDeg: number;
  rightDeg: number;
  leftYawRad: number;
  rightYawRad: number;
  ready: boolean;
}

function targetsForState(state: DiverterState): { left: number; right: number } {
  const l = (GATE_VANE.leftActiveYawDeg * Math.PI) / 180;
  const r = (GATE_VANE.rightActiveYawDeg * Math.PI) / 180;
  if (state === 'DIVERT_LEFT') return { left: l, right: 0 };
  if (state === 'DIVERT_RIGHT') return { left: 0, right: r };
  return { left: 0, right: 0 };
}

function phaseFromTimeline(
  state: DiverterState,
  t: number,
): { phase: DiverterPhase; ready: boolean } {
  if (state === 'STRAIGHT' || t < 0) {
    return { phase: 'READY', ready: true };
  }
  const swing = GATE_VANE.swingSec;
  const holdEnd = swing + GATE_VANE.holdSec;
  const closeEnd = holdEnd + GATE_VANE.retractSec;
  if (t < swing) return { phase: 'OPENING', ready: false };
  if (t < holdEnd) return { phase: 'HOLDING', ready: false };
  if (t < closeEnd) return { phase: 'CLOSING', ready: false };
  return { phase: 'READY', ready: true };
}

/**
 * Authoritative targets for the diverter state machine.
 * During CLOSING / READY after a divert, targets return to 0.
 */
export function getGateState(
  category: 'B' | 'C' | 'D' | null,
  gateTimelineSec: number,
): GateState {
  const mode = categoryToGateMode(category);
  let state = gateModeToDiverterState(mode);
  const t = gateTimelineSec;
  const { phase, ready } = phaseFromTimeline(state, t);

  // After hold, force STRAIGHT targets (closing / ready).
  if (state !== 'STRAIGHT') {
    const swing = GATE_VANE.swingSec;
    const holdEnd = swing + GATE_VANE.holdSec;
    if (t >= holdEnd || t < 0) {
      state = 'STRAIGHT';
    }
  }
  if (mode === 'STRAIGHT' || t < 0) {
    state = 'STRAIGHT';
  }

  const effectiveState: DiverterState =
    phase === 'CLOSING' || phase === 'READY' || t < 0
      ? 'STRAIGHT'
      : gateModeToDiverterState(mode);

  // OPENING/HOLDING keep divert targets; CLOSING/READY → 0.
  const useDivert =
    mode !== 'STRAIGHT'
    && t >= 0
    && phase !== 'CLOSING'
    && phase !== 'READY';

  const tg = targetsForState(useDivert ? gateModeToDiverterState(mode) : 'STRAIGHT');
  const leftDeg = (tg.left * 180) / Math.PI;
  const rightDeg = (tg.right * 180) / Math.PI;

  return {
    mode: useDivert ? mode : 'STRAIGHT',
    state: useDivert ? gateModeToDiverterState(mode) : 'STRAIGHT',
    phase: mode === 'STRAIGHT' || t < 0 ? 'READY' : phase,
    leftTargetRad: tg.left,
    rightTargetRad: tg.right,
    leftDeg,
    rightDeg,
    leftYawRad: tg.left,
    rightYawRad: tg.right,
    ready: ready || !useDivert,
  };
}

/**
 * Explicit motion demo (no product). Wall-clock seconds from demo start.
 *
 * 0–1 STRAIGHT, 1–2 OPEN left, 2–3 HOLD left, 3–4 CLOSE,
 * 4–5 STRAIGHT, 5–6 OPEN right, 6–7 HOLD right, 7–8 CLOSE, 8–9 STRAIGHT.
 */
export function getDiverterDemoState(demoSec: number): GateState {
  const t = Math.max(0, demoSec);
  const L = (GATE_VANE.leftActiveYawDeg * Math.PI) / 180;
  const R = (GATE_VANE.rightActiveYawDeg * Math.PI) / 180;

  const pack = (
    state: DiverterState,
    phase: DiverterPhase,
    left: number,
    right: number,
  ): GateState => ({
    mode: state === 'DIVERT_LEFT' ? 'LEFT' : state === 'DIVERT_RIGHT' ? 'RIGHT' : 'STRAIGHT',
    state,
    phase,
    leftTargetRad: left,
    rightTargetRad: right,
    leftDeg: (left * 180) / Math.PI,
    rightDeg: (right * 180) / Math.PI,
    leftYawRad: left,
    rightYawRad: right,
    ready: phase === 'READY',
  });

  if (t < 1) return pack('STRAIGHT', 'READY', 0, 0);
  if (t < 2) return pack('DIVERT_LEFT', 'OPENING', L, 0);
  if (t < 3) return pack('DIVERT_LEFT', 'HOLDING', L, 0);
  if (t < 4) return pack('STRAIGHT', 'CLOSING', 0, 0);
  if (t < 5) return pack('STRAIGHT', 'READY', 0, 0);
  if (t < 6) return pack('DIVERT_RIGHT', 'OPENING', 0, R);
  if (t < 7) return pack('DIVERT_RIGHT', 'HOLDING', 0, R);
  if (t < 8) return pack('STRAIGHT', 'CLOSING', 0, 0);
  return pack('STRAIGHT', 'READY', 0, 0);
}

export function gateOpenLeadSec(): number {
  return GATE_VANE.openLeadM / CONVEYOR_SPEED_MPS;
}

export function moveTowardsAngle(
  current: number,
  target: number,
  maxDelta: number,
): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

// ---------------------------------------------------------------------------
// Compat API for physicsDropSim / physicsConfigHash
// ---------------------------------------------------------------------------

export const PUSHER = {
  halfExtents: GATE_VANE.halfExtents,
  centerY: GATE_VANE.centerY,
  dirX: 0,
  dirZ: 1,
  yaw: (GATE_VANE.activeDeg * Math.PI) / 180,
  engageX: JUNCTION.x,
  engageZ: 0,
  homeDistance: 0,
  strokeLength: 0,
  strokeSpeed: 0,
  armDelaySec: 0,
  holdSec: GATE_VANE.holdSec,
  retractSpeed: 0,
} as const;

export type PusherPhase = GatePhase;
export interface PusherState {
  active: boolean;
  category: 'C' | 'D' | null;
  phase: PusherPhase;
  x: number;
  z: number;
  yaw: number;
  speed: number;
}

export function getPusherState(
  category: 'B' | 'C' | 'D' | null,
  routingElapsedSec: number,
): PusherState {
  const gateTimelineSec = routingElapsedSec + gateOpenLeadSec();
  const g = getGateState(category, gateTimelineSec);
  const [hx] = GATE_VANE.halfExtents;
  const mode = categoryToGateMode(category);

  if (mode === 'STRAIGHT' || g.state === 'STRAIGHT') {
    return {
      active: false,
      category: null,
      phase: 'rest',
      x: JUNCTION.x - 10,
      z: 0,
      yaw: 0,
      speed: 0,
    };
  }

  const isLeftVane = mode === 'LEFT';
  const pivot = isLeftVane ? JUNCTION.leftPivot : JUNCTION.rightPivot;
  const yaw = isLeftVane ? g.leftYawRad : g.rightYawRad;
  const x = pivot.x - Math.cos(yaw) * hx;
  const z = pivot.z + Math.sin(yaw) * hx;
  const phaseMap: Record<DiverterPhase, GatePhase> = {
    READY: 'rest',
    OPENING: 'opening',
    HOLDING: 'hold',
    CLOSING: 'closing',
  };
  return {
    active: true,
    category: isLeftVane ? 'C' : 'D',
    phase: phaseMap[g.phase],
    x,
    z,
    yaw,
    speed: 0,
  };
}

void BELT_TOP_Y;

// =============================================================================
// Product-synchronized diverter timing (does NOT alter verified CAD kinematics)
// =============================================================================

/** Matches ConveyorCadModel verified visual angular speed (do not change). */
export const DIVERTER_VISUAL_ANGULAR_SPEED_DEG_PER_SEC = 90;
/** Verified signed active angles (do not change). */
export const DIVERTER_LEFT_SIGNED_DEG = -45;
export const DIVERTER_RIGHT_SIGNED_DEG = 45;

export const OPENING_SAFETY_MARGIN_SEC = 0.15;
export const CLEARANCE_MARGIN_M = 0.05;
export const ANGLE_ARRIVE_TOL_RAD = (0.5 * Math.PI) / 180;

/** Classifier confirms route after the item leaves the scan frustum. */
export const CLASSIFIER_PLANE_S = SCAN_END_X;

export type PhysicalRoute = 'STRAIGHT' | 'PHYSICAL_LEFT' | 'PHYSICAL_RIGHT';
export type DiverterProductPhase = 'READY' | 'ARMED' | 'OPENING' | 'HOLDING' | 'CLOSING';
export type ActiveCadDiverter = 'LEFT' | 'RIGHT' | 'NONE';

export interface DiverterRouteCommand {
  productId: string;
  category: 'B' | 'C' | 'D';
  physicalRoute: PhysicalRoute;
  assignedAt: number;
  consumed: boolean;
}

export interface DiverterPlaneSet {
  classifierPlaneS: number;
  contactPlaneS: number;
  hingePlaneS: number;
  clearPlaneS: number;
  diverterLengthM: number;
}

/**
 * Map classifier category → physical route from basket entry coordinates
 * relative to lateral axis (+Z = physical LEFT, −Z = physical RIGHT).
 */
export function categoryToPhysicalRoute(
  category: 'B' | 'C' | 'D',
): PhysicalRoute {
  if (category === 'B') return 'STRAIGHT';
  // JUNCTION entries are the source of truth for chute mouths.
  if (category === JUNCTION.leftEntry.category) return 'PHYSICAL_LEFT';
  if (category === JUNCTION.rightEntry.category) return 'PHYSICAL_RIGHT';
  // Fallback by receiver Z sign vs centerline.
  const z = category === 'C' ? ZONES.C.z : ZONES.D.z;
  if (z > 0) return 'PHYSICAL_LEFT';
  if (z < 0) return 'PHYSICAL_RIGHT';
  return 'STRAIGHT';
}

export function physicalRouteToActiveDiverter(
  route: PhysicalRoute,
): ActiveCadDiverter {
  if (route === 'PHYSICAL_LEFT') return 'LEFT';
  if (route === 'PHYSICAL_RIGHT') return 'RIGHT';
  return 'NONE';
}

export function signedAngleForRoute(route: PhysicalRoute): number {
  if (route === 'PHYSICAL_LEFT') {
    return (DIVERTER_LEFT_SIGNED_DEG * Math.PI) / 180;
  }
  if (route === 'PHYSICAL_RIGHT') {
    return (DIVERTER_RIGHT_SIGNED_DEG * Math.PI) / 180;
  }
  return 0;
}

let routeMappingLogged = false;
/** Idempotent hook — mapping is observable via categoryToPhysicalRoute. */
export function logDiverterRouteMappingOnce(): void {
  if (routeMappingLogged) return;
  routeMappingLogged = true;
}

/** Build longitudinal planes from parked CAD hinge + verified length/angle. */
export function buildDiverterPlanes(
  hingeS: number,
  diverterLengthM: number,
): DiverterPlaneSet {
  const absAng = Math.abs((DIVERTER_LEFT_SIGNED_DEG * Math.PI) / 180);
  // Most-upstream point of the open diagonal (free-end X).
  const contactPlaneS = hingeS - diverterLengthM * Math.cos(absAng);
  const clearPlaneS = hingeS + CLEARANCE_MARGIN_M;
  return {
    classifierPlaneS: CLASSIFIER_PLANE_S,
    contactPlaneS,
    hingePlaneS: hingeS,
    clearPlaneS,
    diverterLengthM,
  };
}

export function rotationDurationSec(): number {
  const ang = Math.abs((DIVERTER_LEFT_SIGNED_DEG * Math.PI) / 180);
  const spd = (DIVERTER_VISUAL_ANGULAR_SPEED_DEG_PER_SEC * Math.PI) / 180;
  return ang / spd;
}

export interface DiverterProductMachineState {
  phase: DiverterProductPhase;
  active: DiverterRouteCommand | null;
  pending: DiverterRouteCommand | null;
  leftTargetRad: number;
  rightTargetRad: number;
  openLoggedFor: string | null;
  closeLoggedFor: string | null;
}

export function createDiverterProductMachine(): DiverterProductMachineState {
  return {
    phase: 'READY',
    active: null,
    pending: null,
    leftTargetRad: 0,
    rightTargetRad: 0,
    openLoggedFor: null,
    closeLoggedFor: null,
  };
}

export function resetDiverterProductMachine(
  m: DiverterProductMachineState,
): void {
  m.phase = 'READY';
  m.active = null;
  m.pending = null;
  m.leftTargetRad = 0;
  m.rightTargetRad = 0;
  m.openLoggedFor = null;
  m.closeLoggedFor = null;
}

export interface DiverterProductStepInput {
  productId: string | null;
  category: 'B' | 'C' | 'D' | null;
  itemCenterS: number;
  itemHalfLengthS: number;
  itemSpeedMps: number;
  leftCurrentRad: number;
  rightCurrentRad: number;
  planes: DiverterPlaneSet;
  paused: boolean;
  reset: boolean;
  nowMs: number;
}

export interface DiverterProductStepResult {
  phase: DiverterProductPhase;
  leftTargetRad: number;
  rightTargetRad: number;
  activeDiverter: ActiveCadDiverter;
  command: DiverterRouteCommand | null;
  itemFrontS: number;
  itemRearS: number;
  distanceToContact: number;
  requiredLeadDistance: number;
  timeToContact: number;
  telemetry: Record<string, unknown>;
}

function setTargetsForRoute(
  m: DiverterProductMachineState,
  route: PhysicalRoute,
): void {
  if (route === 'PHYSICAL_LEFT') {
    m.leftTargetRad = signedAngleForRoute(route);
    m.rightTargetRad = 0;
  } else if (route === 'PHYSICAL_RIGHT') {
    m.leftTargetRad = 0;
    m.rightTargetRad = signedAngleForRoute(route);
  } else {
    m.leftTargetRad = 0;
    m.rightTargetRad = 0;
  }
}

function anglesNearZero(left: number, right: number): boolean {
  return Math.abs(left) <= ANGLE_ARRIVE_TOL_RAD
    && Math.abs(right) <= ANGLE_ARRIVE_TOL_RAD;
}

function activeAngleReached(
  route: PhysicalRoute,
  left: number,
  right: number,
): boolean {
  if (route === 'PHYSICAL_LEFT') {
    return Math.abs(left - signedAngleForRoute(route)) <= ANGLE_ARRIVE_TOL_RAD
      && Math.abs(right) <= ANGLE_ARRIVE_TOL_RAD;
  }
  if (route === 'PHYSICAL_RIGHT') {
    return Math.abs(right - signedAngleForRoute(route)) <= ANGLE_ARRIVE_TOL_RAD
      && Math.abs(left) <= ANGLE_ARRIVE_TOL_RAD;
  }
  return true;
}

/**
 * Advance product-tied diverter state. Angle interpolation stays in the visual
 * layer (ConveyorCadModel); this only sets targets + phase.
 */
export function stepDiverterProductMachine(
  m: DiverterProductMachineState,
  input: DiverterProductStepInput,
): DiverterProductStepResult {
  logDiverterRouteMappingOnce();

  if (input.reset) {
    resetDiverterProductMachine(m);
  }

  const itemFrontS = input.itemCenterS + input.itemHalfLengthS;
  const itemRearS = input.itemCenterS - input.itemHalfLengthS;
  const speed = Math.max(input.itemSpeedMps, 0.05);
  const rotDur = rotationDurationSec();
  const requiredLeadDistance = speed * (rotDur + OPENING_SAFETY_MARGIN_SEC);
  const distanceToContact = input.planes.contactPlaneS - itemFrontS;
  const timeToContact = distanceToContact / speed;

  // Enqueue / arm route command for a concrete productId after classifier plane.
  if (
    input.productId
    && input.category
    && itemFrontS >= input.planes.classifierPlaneS
  ) {
    const physicalRoute = categoryToPhysicalRoute(input.category);
    const sameActive = m.active?.productId === input.productId;
    const samePending = m.pending?.productId === input.productId;
    if (!sameActive && !samePending) {
      const cmd: DiverterRouteCommand = {
        productId: input.productId,
        category: input.category,
        physicalRoute,
        assignedAt: input.nowMs,
        consumed: false,
      };
      if (m.phase === 'READY' && !m.active) {
        m.active = cmd;
        m.phase = 'ARMED';
        m.leftTargetRad = 0;
        m.rightTargetRad = 0;
        m.openLoggedFor = null;
        m.closeLoggedFor = null;
      } else if (!m.active || m.active.productId !== input.productId) {
        // Do not overwrite active command.
        if (!m.pending) m.pending = cmd;
      }
    }
  }

  if (!input.paused && m.active) {
    const route = m.active.physicalRoute;
    const activeDiv = physicalRouteToActiveDiverter(route);

    if (m.phase === 'ARMED') {
      if (route === 'STRAIGHT') {
        // No motion; complete after rear clears.
        m.leftTargetRad = 0;
        m.rightTargetRad = 0;
        if (itemRearS > input.planes.clearPlaneS) {
          m.active.consumed = true;
          m.active = null;
          m.phase = 'READY';
          if (m.pending) {
            m.active = m.pending;
            m.pending = null;
            m.phase = 'ARMED';
            m.openLoggedFor = null;
            m.closeLoggedFor = null;
          }
        }
      } else if (
        distanceToContact <= requiredLeadDistance
        && itemRearS < input.planes.clearPlaneS
      ) {
        m.phase = 'OPENING';
        setTargetsForRoute(m, route);
        if (m.openLoggedFor !== m.active.productId) {
          m.openLoggedFor = m.active.productId;
        }
      }
    } else if (m.phase === 'OPENING') {
      setTargetsForRoute(m, route);
      if (activeAngleReached(route, input.leftCurrentRad, input.rightCurrentRad)) {
        m.phase = 'HOLDING';
      } else if (itemRearS > input.planes.clearPlaneS) {
        // Product cleared before full open (edge case) — still close safely.
        m.phase = 'CLOSING';
        m.leftTargetRad = 0;
        m.rightTargetRad = 0;
      }
    } else if (m.phase === 'HOLDING') {
      setTargetsForRoute(m, route);
      if (itemRearS > input.planes.clearPlaneS) {
        m.phase = 'CLOSING';
        m.leftTargetRad = 0;
        m.rightTargetRad = 0;
        if (m.closeLoggedFor !== m.active.productId) {
          m.closeLoggedFor = m.active.productId;
        }
      }
    } else if (m.phase === 'CLOSING') {
      m.leftTargetRad = 0;
      m.rightTargetRad = 0;
      if (anglesNearZero(input.leftCurrentRad, input.rightCurrentRad)) {
        if (m.active) m.active.consumed = true;
        m.active = null;
        m.phase = 'READY';
        if (m.pending) {
          m.active = m.pending;
          m.pending = null;
          m.phase = 'ARMED';
          m.openLoggedFor = null;
          m.closeLoggedFor = null;
          m.leftTargetRad = 0;
          m.rightTargetRad = 0;
        }
      }
    }
  }

  // Case advanced / active product replaced → finish current command safely.
  // Do NOT treat the next product's S as the active product's rear edge.
  if (
    m.active
    && input.productId
    && input.productId !== m.active.productId
    && m.phase !== 'READY'
    && m.phase !== 'CLOSING'
  ) {
    if (m.phase === 'ARMED' && m.active.physicalRoute === 'STRAIGHT') {
      m.active.consumed = true;
      m.active = m.pending;
      m.pending = null;
      m.phase = m.active ? 'ARMED' : 'READY';
      m.leftTargetRad = 0;
      m.rightTargetRad = 0;
      m.openLoggedFor = null;
      m.closeLoggedFor = null;
    } else {
      m.phase = 'CLOSING';
      m.leftTargetRad = 0;
      m.rightTargetRad = 0;
      if (m.closeLoggedFor !== m.active.productId) {
        m.closeLoggedFor = m.active.productId;
      }
    }
  }

  const activeDiverter = m.active
    ? physicalRouteToActiveDiverter(m.active.physicalRoute)
    : 'NONE';

  const telemetry = {
    productId: m.active?.productId ?? input.productId,
    category: m.active?.category ?? input.category,
    physicalRoute: m.active?.physicalRoute ?? null,
    motionState: m.phase,
    itemFrontS: +itemFrontS.toFixed(4),
    itemRearS: +itemRearS.toFixed(4),
    distanceToContact: +distanceToContact.toFixed(4),
    requiredLeadDistance: +requiredLeadDistance.toFixed(4),
    timeToContact: +timeToContact.toFixed(4),
    leftCurrentDeg: +((input.leftCurrentRad * 180) / Math.PI).toFixed(2),
    leftTargetDeg: +((m.leftTargetRad * 180) / Math.PI).toFixed(2),
    rightCurrentDeg: +((input.rightCurrentRad * 180) / Math.PI).toFixed(2),
    rightTargetDeg: +((m.rightTargetRad * 180) / Math.PI).toFixed(2),
    activeDiverter,
    contactPlaneS: +input.planes.contactPlaneS.toFixed(4),
    clearPlaneS: +input.planes.clearPlaneS.toFixed(4),
    pendingProductId: m.pending?.productId ?? null,
  };

  return {
    phase: m.phase,
    leftTargetRad: m.leftTargetRad,
    rightTargetRad: m.rightTargetRad,
    activeDiverter,
    command: m.active,
    itemFrontS,
    itemRearS,
    distanceToContact,
    requiredLeadDistance,
    timeToContact,
    telemetry,
  };
}
