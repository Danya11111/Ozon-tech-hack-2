import { classifyItem } from './classifier';
import { createMetrics, recordCycle } from './metrics';
import { createPidState, updatePid } from './pid';
import type {
  Category,
  EventLogEntry,
  MachineState,
  Scenario,
  SimulationState,
  SystemStatus,
} from './types';

const STATE_DURATIONS_MS: Partial<Record<MachineState, number>> = {
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

const ROUTE_STATE_BY_CATEGORY: Record<Category, MachineState> = {
  B: 'ROUTE_TO_B',
  C: 'ROUTE_TO_C',
  D: 'ROUTE_TO_D',
};

let eventCounter = 0;

function event(timestampMs: number, entry: Omit<EventLogEntry, 'id' | 'timestampMs'>): EventLogEntry {
  eventCounter += 1;
  return {
    id: `evt-${eventCounter}`,
    timestampMs,
    ...entry,
  };
}

function appendEvent(state: SimulationState, entry: Omit<EventLogEntry, 'id' | 'timestampMs'>): SimulationState {
  return {
    ...state,
    events: [event(state.simTimeMs, entry), ...state.events].slice(0, 80),
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
      message: `Camera captured bbox, confidence ${Math.round(item.confidence * 100)}%`,
      category: state.currentItem?.classification.category,
      status: item.confidence < 0.65 ? 'warning' : 'info',
    });
  }

  if (nextState === 'WAITING_AT_GATE') {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'actuator',
      message: 'Stop-gate closed, item fixed before classification',
      status: 'info',
    });
  }

  if (nextState === 'CLASSIFYING' && state.currentItem) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'classification',
      message: `${state.currentItem.classification.label}: ${state.currentItem.classification.reason}`,
      category: state.currentItem.classification.category,
      status: state.currentItem.classification.warnings.length > 0 ? 'warning' : 'success',
    });
  }

  if (nextState.startsWith('ROUTE_TO_') && state.currentItem) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'routing',
      message: `Route selected: ${state.currentItem.classification.category}`,
      category: state.currentItem.classification.category,
      status: 'success',
    });
  }

  return next;
}

function startNextItem(state: SimulationState): SimulationState {
  const item = state.scenario.items[state.itemIndex];
  if (!item) {
    return { ...state, machineState: 'IDLE', running: false, systemStatus: 'PAUSED' };
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
    itemIndex: state.itemIndex + 1,
  };

  next = appendEvent(next, {
    itemId: item.id,
    type: 'system',
    message: `Item entered zone A: ${item.name}`,
    status: 'info',
  });

  if (state.scenario.id === 'close_items' && state.itemIndex === 0) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'warning',
      message: 'Queue/spacing warning: next item detected too close, processing sequentially',
      status: 'warning',
    });
  }

  for (const warning of classification.warnings) {
    next = appendEvent(next, {
      itemId: item.id,
      type: 'warning',
      message: warning,
      category: classification.category,
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
      metrics,
    },
    {
      itemId: state.currentItem.item.id,
      type: 'routing',
      message: `Cycle completed in ${(cycleTimeMs / 1000).toFixed(1)}s`,
      category: state.currentItem.classification.category,
      status: success ? 'success' : 'error',
    },
  );

  next = {
    ...next,
    currentItem: undefined,
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
  return state.scenario.id === 'close_items' ? 0.32 : 0.42;
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

  const duration = STATE_DURATIONS_MS[next.machineState];
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
        next = next.itemIndex < next.scenario.items.length ? startNextItem(next) : { ...next, machineState: 'IDLE', running: false, systemStatus: 'PAUSED', elapsedInStateMs: 0 };
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

  next = {
    ...next,
    pid,
    systemStatus: next.running ? 'RUNNING' : next.systemStatus,
    metrics: {
      ...next.metrics,
      cvLatencyMs,
      actuatorLatencyMs,
      queueLength,
      conveyorSpeedMps: pid.actualSpeedMps,
      pidTargetSpeedMps: pid.targetSpeedMps,
      pidActualSpeedMps: pid.actualSpeedMps,
    },
  };

  return deriveSensorsAndActuators(next);
}
