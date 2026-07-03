export type Category = 'B' | 'C' | 'D';

export type MachineState =
  | 'IDLE'
  | 'MOVING_TO_CAMERA'
  | 'DETECTING'
  | 'MOVING_TO_GATE'
  | 'WAITING_AT_GATE'
  | 'CLASSIFYING'
  | 'ROUTE_TO_B'
  | 'ROUTE_TO_C'
  | 'ROUTE_TO_D'
  | 'RETURN_HOME'
  | 'FAULT'
  | 'EMERGENCY_STOP';

export type SystemStatus = 'RUNNING' | 'PAUSED' | 'FAULT' | 'EMERGENCY_STOP';

export type ScenarioId =
  | 'normal_flow'
  | 'oversized_item'
  | 'round_object'
  | 'boundary_dimensions'
  | 'close_items'
  | 'low_confidence'
  | 'jam'
  | 'emergency_stop';

export type SensorKind = 'camera' | 'laser' | 'ultrasound';
export type EventType = 'system' | 'sensor' | 'classification' | 'actuator' | 'routing' | 'warning' | 'fault';
export type EventStatus = 'info' | 'success' | 'warning' | 'error';
export type PusherState = 'idle' | 'extended' | 'retracting';

export interface DimensionsMm {
  width: number;
  depth: number;
  height: number;
}

export interface Item {
  id: string;
  name: string;
  dimensionsMm: DimensionsMm;
  roundness: number;
  confidence: number;
  shape: string;
  expectedCategory: Category;
}

export interface CategoryDefinition {
  label: string;
  reason: string;
}

export interface ClassificationResult {
  category: Category;
  label: string;
  reason: string;
  dimensionsPass: boolean;
  roundnessPass: boolean;
  warnings: string[];
}

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  items: Item[];
  initialStatus?: SystemStatus;
}

export interface EventLogEntry {
  id: string;
  timestampMs: number;
  itemId?: string;
  type: EventType;
  message: string;
  category?: Category;
  status: EventStatus;
}

export interface Metrics {
  processedCount: number;
  successCount: number;
  errorCount: number;
  avgCycleTimeMs: number;
  throughputItemsPerMin: number;
  cvLatencyMs: number;
  actuatorLatencyMs: number;
  queueLength: number;
  conveyorSpeedMps: number;
  pidTargetSpeedMps: number;
  pidActualSpeedMps: number;
}

export interface SensorState {
  kind: SensorKind;
  label: string;
  active: boolean;
  lastValue: string;
  latencyMs: number;
  lastEventTimestampMs: number;
}

export interface CameraState extends SensorState {
  kind: 'camera';
  bbox?: BoundingBox;
  confidence?: number;
  cvLatencyMs: number;
}

export interface LaserState extends SensorState {
  kind: 'laser';
  measuredHeightMm?: number;
}

export interface UltrasoundState extends SensorState {
  kind: 'ultrasound';
  distanceToGateMm?: number;
  objectAtGate: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StopGateState {
  open: boolean;
}

export interface ActuatorState {
  pusherC: PusherState;
  pusherD: PusherState;
}

export interface PidState {
  targetSpeedMps: number;
  actualSpeedMps: number;
  pidError: number;
  correction: number;
}

export interface SimulatedItem {
  item: Item;
  startedAtMs: number;
  classification: ClassificationResult;
  cycleTimeMs: number;
}

export interface SimulationState {
  scenario: Scenario;
  systemStatus: SystemStatus;
  running: boolean;
  machineState: MachineState;
  itemIndex: number;
  elapsedInStateMs: number;
  simTimeMs: number;
  currentItem?: SimulatedItem;
  metrics: Metrics;
  sensors: {
    camera: CameraState;
    laser: LaserState;
    ultrasound: UltrasoundState;
  };
  gate: StopGateState;
  actuators: ActuatorState;
  pid: PidState;
  events: EventLogEntry[];
  activeRoute?: Category;
}
