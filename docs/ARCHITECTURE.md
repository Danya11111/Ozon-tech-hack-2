# Architecture

## Module Map

```text
src/data/items.ts
src/data/scenarios.ts
        |
        v
src/domain/classifier.ts  ->  src/domain/simulation.ts  ->  React UI components
        |                         |
        |                         +-> metrics, PID, sensors, event log
        v
classification result
```

## Data Flow

1. Scenario selects a sequence of mock items.
2. Simulation feeds one item at a time into zone A.
3. Pseudo-CV and sensors derive measurements from item data.
4. `classifyItem` applies deterministic rules.
5. State machine commands gate and pushers.
6. UI renders SVG scene, panels, metrics, timeline and event log.

## Pseudo-CV

The MVP does not run real ML. Camera output is generated from item dimensions:

- bbox width/depth;
- confidence;
- CV latency;
- detected dimensions.

Low confidence is not ignored: the event log and classification panel show a warning and explain rule-based fallback.

## Sensor Simulation

- Camera is active in `DETECTING`.
- Laser is active during `DETECTING` and `MOVING_TO_GATE`.
- Ultrasonic sensor is active at `WAITING_AT_GATE` and `CLASSIFYING`.

Each sensor keeps active state, last value, latency and last event timestamp.

## Actuator Control

- Stop-gate closes at `WAITING_AT_GATE`.
- B route opens the gate and sends item straight.
- C route keeps the gate closed and extends pusher C.
- D route keeps the gate closed and extends pusher D.
- `RETURN_HOME` retracts mechanisms.

## State Machine

Main cycle:

```text
IDLE -> MOVING_TO_CAMERA -> DETECTING -> MOVING_TO_GATE -> WAITING_AT_GATE
-> CLASSIFYING -> ROUTE_TO_B/C/D -> RETURN_HOME -> next item or IDLE
```

Fault states:

- `FAULT` for jam at gate;
- `EMERGENCY_STOP` for emergency stop scenario.

Both stop conveyor motion and require Reset.

## Metrics

The dashboard tracks processed count, success/error count, avg cycle time, throughput, CV latency, actuator latency, queue length, queue delay and conveyor speed.
