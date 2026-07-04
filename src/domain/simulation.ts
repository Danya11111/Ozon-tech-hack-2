import { classifyItem } from './classifier';
import { createMetrics, recordCycle } from './metrics';
import { createPidState, updatePid } from './pid';
import type {
  Category,
  CycleTimelineEntry,
  EventLogEntry,
  MachineState,
  Scenario,
  SimulationState,
  SystemStatus,
} from './types';

export const STATE_DURATIONS_MS: Record<Exclude<MachineState, 'IDLE' | 'FAULT' | 'EMERGENCY_STOP'>, number> = {
  MOVING_TO_CAMERA: 1200,
  DETECTING: 900,
  MOVING_TO_GATE: 1300,
  WAITING_AT_GATE: 800,
  CLASSIFYING: 700,
  ROUTE_TO_B: 1200,
  ROUTE_TO_C: 1200,
  ROUTE_TO_D: 1200,
  RETURN_HOME: 700,
};

export const CYCLE_STATE_ORDER: MachineState[] = [
  'MOVING_TO_CAMERA',
  'DETECTING',
  'MOVING_TO_GATE',
  'WAITING_AT_GATE',
  'CLASSIFYING',
  'ROUTE_TO_B',
  'ROUTE_TO_C',
  'ROUTE_TO_D',
  'RETURN_HOME',
];

const ROUTE_STATE_BY_CATEGORY: Record<Category, MachineState> = {
  B: 'ROUTE_TO_B',
  C: 'ROUTE_TO_C',
  D: 'ROUTE_TO_D',
};

let eventCounter = 0;

type EventInput = Omit<EventLogEntry, 'id' | 'timestampMs'>;

function event(timestampMs: number, entry: EventInput): EventLogEntry {
  eventCounter += 1;
  return {
    id: `evt-${eventCounter}`,
    timestampMs,
    ...entry,
  };
}

function appendEvent(state: SimulationState, entry: EventInput): SimulationState {
  return {
    ...state,
    events: [event(state.simTimeMs, { state: state.machineState, ...entry }), ...state.events].slice(0, 120),
  };
}

function transitionTo(state: SimulationState, nextState: MachineState): SimulationState {
  const item = state.currentItem?.item;
  let next: SimulationState = {
    ...state,
    machineState: nextState,
    elapsedInStateMs: 0,
    activeRoute: nextState.startsWith('ROUTE_TO_') ? state.currentItem?.classification.category : undefined,
  };

  if (!item) {
    return next;
  }

  if (nextState === 'DETECTING') {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'sensor',
      message: `Camera bbox ${item.dimensionsMm.width}x${item.dimensionsMm.depth} mm, confidence ${Math.round(item.confidence * 100)}%`,
      category: state.currentItem?.classification.category,
      command: 'CAMERA_CAPTURE',
      state: nextState,
      status: item.confidence < 0.65 ? 'warning' : 'info',
    });
  }

  if (nextState === 'WAITING_AT_GATE') {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'actuator',
      message: 'Stop-gate closed, item fixed before classification',
      command: 'GATE_CLOSE',
      state: nextState,
      status: 'info',
    });
  }

  if (nextState === 'CLASSIFYING' && state.currentItem) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'classification',
      message: `${state.currentItem.classification.label}: ${state.currentItem.classification.reason}`,
      category: state.currentItem.classification.category,
      command: 'CLASSIFY_RULE_BASED',
      state: nextState,
      status: state.currentItem.classification.warnings.length > 0 ? 'warning' : 'success',
    });
  }

  if (nextState.startsWith('ROUTE_TO_') && state.currentItem) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'routing',
      message: `Route selected: ${state.currentItem.classification.category}`,
      category: state.currentItem.classification.category,
      command: nextState,
      state: nextState,
      status: 'success',
    });
  }

  return next;
}

function startNextItem(state: SimulationState): SimulationState {
  const item = state.scenario.items[state.itemIndex];
  if (!item) {
    return { ...state, machineState: 'IDLE', running: false, systemStatus: 'PAUSED', currentItem: undefined };
  }

  const classification = classifyItem(item);
  let next: SimulationState = {
    ...state,
    currentItem: {
      item,
      classification,
      startedAtMs: state.simTimeMs,
      cycleTimeMs: 0,
    },
    machineState: 'MOVING_TO_CAMERA',
    elapsedInStateMs: 0,
    activeRoute: undefined,
    itemIndex: state.itemIndex + 1,
  };

  next = appendEvent(next, {
    itemId: item.id,
    type: 'system',
    message: `Item entered zone A: ${item.name}`,
    command: 'FEED_ITEM',
    state: 'MOVING_TO_CAMERA',
    status: 'info',
  });

  if (state.scenario.id === 'close_items' && state.itemIndex === 0) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'warning',
      message: 'Queue/spacing warning: next item detected too close, processing sequentially',
      command: 'QUEUE_HOLD_NEXT_ITEM',
      state: 'MOVING_TO_CAMERA',
      status: 'warning',
    });
  }

  for (const warning of classification.warnings) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'warning',
      message: warning,
      category: classification.category,
      command: 'RULE_BASED_FALLBACK',
      state: 'MOVING_TO_CAMERA',
      status: 'warning',
    });
  }

  return next;
}

function completeCurrentItem(state: SimulationState): SimulationState {
  if (!state.currentItem) {
    return state;
  }

  const cycleTimeMs = state.simTimeMs - state.currentItem.startedAtMs;
  const success = state.currentItem.classification.category === state.currentItem.item.expectedCategory;
  const metrics = recordCycle(state.metrics, cycleTimeMs, success);

  let next = appendEvent(
    {
      ...state,
      currentItem: {
        ...state.currentItem,
        cycleTimeMs,
      },
      metrics,
    },
    {
      itemId: state.currentItem.item.id,
      type: 'routing',
      message: `Cycle completed in ${(cycleTimeMs / 1000).toFixed(1)}s`,
      category: state.currentItem.classification.category,
      command: 'CYCLE_COMPLETE',
      status: success ? 'success' : 'error',
    },
  );

  next = {
    ...next,
    activeRoute: undefined,
  };

  return transitionTo(next, 'RETURN_HOME');
}

function targetSpeedFor(state: SimulationState): number {
  if (state.machineState === 'FAULT' || state.machineState === 'EMERGENCY_STOP') {
    return 0;
  }
  if (!state.running) {
    return 0;
  }
  return state.scenario.id === 'close_items' ? 0.75 : 1;
}

function deriveSensorsAndActuators(state: SimulationState): SimulationState {
  const item = state.currentItem?.item;
  const classification = state.currentItem?.classification;
  const cameraActive = state.machineState === 'DETECTING';
  const laserActive = state.machineState === 'DETECTING' || state.machineState === 'MOVING_TO_GATE';
  const ultrasoundActive = state.machineState === 'WAITING_AT_GATE' || state.machineState === 'CLASSIFYING';
  const route = classification?.category;
  const routeToC = state.machineState === 'ROUTE_TO_C';
  const routeToD = state.machineState === 'ROUTE_TO_D';

  return {
    ...state,
    gate: {
      open: state.machineState === 'ROUTE_TO_B' || state.machineState === 'IDLE',
    },
    actuators: {
      pusherC: routeToC ? 'extended' : state.machineState === 'RETURN_HOME' && route === 'C' ? 'retracting' : 'idle',
      pusherD: routeToD ? 'extended' : state.machineState === 'RETURN_HOME' && route === 'D' ? 'retracting' : 'idle',
    },
    sensors: {
      camera: {
        kind: 'camera',
        label: 'Camera / pseudo-CV',
        active: cameraActive,
        lastValue: item ? `bbox ${item.dimensionsMm.width}x${item.dimensionsMm.depth} mm` : 'idle',
        latencyMs: item ? Math.round(38 + (1 - item.confidence) * 80) : 0,
        lastEventTimestampMs: cameraActive ? state.simTimeMs : state.sensors.camera.lastEventTimestampMs,
        bbox: item ? { x: 0, y: 0, width: item.dimensionsMm.width, height: item.dimensionsMm.depth } : undefined,
        confidence: item?.confidence,
        cvLatencyMs: item ? Math.round(38 + (1 - item.confidence) * 80) : 0,
      },
      laser: {
        kind: 'laser',
        label: 'Laser height sensor',
        active: laserActive,
        lastValue: item ? `${item.dimensionsMm.height} mm` : 'idle',
        latencyMs: item ? 14 : 0,
        lastEventTimestampMs: laserActive ? state.simTimeMs : state.sensors.laser.lastEventTimestampMs,
        measuredHeightMm: item?.dimensionsMm.height,
      },
      ultrasound: {
        kind: 'ultrasound',
        label: 'Ultrasound gate sensor',
        active: ultrasoundActive,
        lastValue: ultrasoundActive ? 'object at gate' : item ? 'tracking' : 'idle',
        latencyMs: item ? 22 : 0,
        lastEventTimestampMs: ultrasoundActive ? state.simTimeMs : state.sensors.ultrasound.lastEventTimestampMs,
        distanceToGateMm: ultrasoundActive ? 0 : item ? 900 : undefined,
        objectAtGate: ultrasoundActive,
      },
    },
  };
}

export function createSimulation(scenario: Scenario): SimulationState {
  const pid = createPidState();
  return deriveSensorsAndActuators({
    scenario,
    systemStatus: 'PAUSED',
    running: false,
    machineState: 'IDLE',
    itemIndex: 0,
    elapsedInStateMs: 0,
    simTimeMs: 0,
    currentItem: undefined,
    metrics: createMetrics(),
    sensors: {
      camera: {
        kind: 'camera',
        label: 'Camera / pseudo-CV',
        active: false,
        lastValue: 'idle',
        latencyMs: 0,
        lastEventTimestampMs: 0,
        cvLatencyMs: 0,
      },
      laser: {
        kind: 'laser',
        label: 'Laser height sensor',
        active: false,
        lastValue: 'idle',
        latencyMs: 0,
        lastEventTimestampMs: 0,
      },
      ultrasound: {
        kind: 'ultrasound',
        label: 'Ultrasound gate sensor',
        active: false,
        lastValue: 'idle',
        latencyMs: 0,
        lastEventTimestampMs: 0,
        objectAtGate: false,
      },
    },
    gate: { open: true },
    actuators: { pusherC: 'idle', pusherD: 'idle' },
    pid,
    events: [],
  });
}

export function setRunning(state: SimulationState, running: boolean): SimulationState {
  const systemStatus: SystemStatus = state.machineState === 'FAULT' ? 'FAULT' : state.machineState === 'EMERGENCY_STOP' ? 'EMERGENCY_STOP' : running ? 'RUNNING' : 'PAUSED';
  return deriveSensorsAndActuators({ ...state, running, systemStatus });
}

export function stepSimulation(state: SimulationState, deltaMs: number, forceStep = false): SimulationState {
  if (!state.running && !forceStep) {
    return state;
  }

  let next: SimulationState = {
    ...state,
    simTimeMs: state.simTimeMs + deltaMs,
    elapsedInStateMs: state.elapsedInStateMs + deltaMs,
  };

  const shouldEmergencyStop = next.scenario.id === 'emergency_stop' && next.simTimeMs >= 1800;
  if (shouldEmergencyStop && next.machineState !== 'EMERGENCY_STOP') {
    next = appendEvent(next, {
      itemId: next.currentItem?.item.id,
      type: 'fault',
      message: 'Emergency stop pressed, all movement stopped',
      command: 'EMERGENCY_STOP',
      status: 'error',
    });
    next = { ...next, machineState: 'EMERGENCY_STOP', running: false, systemStatus: 'EMERGENCY_STOP' };
  }

  const shouldJam = next.scenario.id === 'jam' && next.machineState === 'WAITING_AT_GATE' && next.elapsedInStateMs >= 700;
  if (shouldJam) {
    next = appendEvent(next, {
      itemId: next.currentItem?.item.id,
      type: 'fault',
      message: 'Jam detected at stop-gate, conveyor stopped',
      category: next.currentItem?.classification.category,
      command: 'CONVEYOR_STOP_FAULT',
      status: 'error',
    });
    next = { ...next, machineState: 'FAULT', running: false, systemStatus: 'FAULT' };
  }

  if (next.machineState === 'FAULT' || next.machineState === 'EMERGENCY_STOP') {
    const pid = updatePid(next.pid, 0, deltaMs);
    return deriveSensorsAndActuators({
      ...next,
      pid,
      metrics: {
        ...next.metrics,
        conveyorSpeedMps: pid.actualSpeedMps,
        pidTargetSpeedMps: pid.targetSpeedMps,
        pidActualSpeedMps: pid.actualSpeedMps,
      },
    });
  }

  if (next.machineState === 'IDLE') {
    next = startNextItem(next);
  }

  const duration = next.machineState in STATE_DURATIONS_MS ? STATE_DURATIONS_MS[next.machineState as keyof typeof STATE_DURATIONS_MS] : undefined;
  if (duration && next.elapsedInStateMs >= duration) {
    switch (next.machineState) {
      case 'MOVING_TO_CAMERA':
        next = transitionTo(next, 'DETECTING');
        break;
      case 'DETECTING':
        next = transitionTo(next, 'MOVING_TO_GATE');
        break;
      case 'MOVING_TO_GATE':
        next = transitionTo(next, 'WAITING_AT_GATE');
        break;
      case 'WAITING_AT_GATE':
        next = transitionTo(next, 'CLASSIFYING');
        break;
      case 'CLASSIFYING':
        if (next.currentItem) {
          next = transitionTo(next, ROUTE_STATE_BY_CATEGORY[next.currentItem.classification.category]);
        }
        break;
      case 'ROUTE_TO_B':
      case 'ROUTE_TO_C':
      case 'ROUTE_TO_D':
        next = completeCurrentItem(next);
        break;
      case 'RETURN_HOME':
        next = next.itemIndex < next.scenario.items.length ? startNextItem(next) : { ...next, currentItem: undefined, machineState: 'IDLE', running: false, systemStatus: 'PAUSED', elapsedInStateMs: 0 };
        break;
      default:
        break;
    }
  }

  const targetSpeed = targetSpeedFor(next);
  const pid = updatePid(next.pid, targetSpeed, deltaMs);
  const queueLength = Math.max(next.scenario.items.length - next.itemIndex, 0) + (next.currentItem ? 1 : 0);
  const cvLatencyMs = next.sensors.camera.cvLatencyMs || next.metrics.cvLatencyMs;
  const actuatorLatencyMs = next.actuators.pusherC !== 'idle' || next.actuators.pusherD !== 'idle' ? 115 : next.machineState === 'ROUTE_TO_B' ? 55 : 0;
  const queueDelayMs = next.scenario.id === 'close_items' && queueLength > 1 ? 450 : 0;

  next = {
    ...next,
    pid,
    systemStatus: next.running ? 'RUNNING' : next.systemStatus,
    metrics: {
      ...next.metrics,
      cvLatencyMs,
      actuatorLatencyMs,
      queueLength,
      queueDelayMs,
      conveyorSpeedMps: pid.actualSpeedMps,
      pidTargetSpeedMps: pid.targetSpeedMps,
      pidActualSpeedMps: pid.actualSpeedMps,
    },
  };

  return deriveSensorsAndActuators(next);
}

export function stepSimulationToNextState(state: SimulationState): SimulationState {
  if (state.machineState === 'FAULT' || state.machineState === 'EMERGENCY_STOP') {
    return state;
  }

  const runningState = setRunning({ ...state, running: true, systemStatus: 'RUNNING' }, true);
  let deltaMs = 1;

  if (runningState.scenario.id === 'emergency_stop') {
    deltaMs = Math.max(1, 1800 - runningState.simTimeMs);
  } else if (runningState.scenario.id === 'jam' && runningState.machineState === 'WAITING_AT_GATE') {
    deltaMs = Math.max(1, 700 - runningState.elapsedInStateMs);
  } else if (runningState.machineState in STATE_DURATIONS_MS) {
    const duration = STATE_DURATIONS_MS[runningState.machineState as keyof typeof STATE_DURATIONS_MS];
    deltaMs = Math.max(1, duration - runningState.elapsedInStateMs);
  }

  const stepped = stepSimulation(runningState, deltaMs, true);
  return setRunning(stepped, false);
}

export function buildCycleTimeline(state: SimulationState): CycleTimelineEntry[] {
  const current = state.currentItem;
  const activeRoute = current ? ROUTE_STATE_BY_CATEGORY[current.classification.category] : undefined;
  let cursor = current?.startedAtMs ?? state.simTimeMs;

  return CYCLE_STATE_ORDER.map((machineState) => {
    const isRouteState = machineState.startsWith('ROUTE_TO_');
    const skipped = isRouteState && machineState !== activeRoute;
    const durationMs = STATE_DURATIONS_MS[machineState as keyof typeof STATE_DURATIONS_MS] ?? 0;
    const startedAtMs = current && !skipped ? cursor : undefined;
    let status: CycleTimelineEntry['status'] = current ? 'pending' : 'pending';

    if (skipped) {
      status = 'skipped';
    } else if (current && machineState === state.machineState) {
      status = 'active';
    } else if (current && startedAtMs !== undefined && state.simTimeMs >= startedAtMs + durationMs) {
      status = 'done';
    }

    if (!skipped) {
      cursor += durationMs;
    }

    return {
      state: machineState,
      startedAtMs,
      durationMs,
      status,
    };
  });
}
