# Jury Q&A

## 1. Why 2D, Not 3D?

2D is enough for MVP validation: it shows geometry, timing, sensor positions, routes and state transitions without spending effort on heavy rendering.

## 2. Where Is Computer Vision?

The MVP uses pseudo-CV: bbox, dimensions, confidence and latency are derived from mock items. The architecture keeps CV output separate from classification, so a real CV service can replace it later.

## 3. How Is Classification Correctness Proven?

The decision tree shows PASS/FAIL for dimensions and roundness, actual values, thresholds and final category. Tests cover key boundary cases.

## 4. How Are Dimensions And Circular Section Handled?

Dimensions are checked first against min/max width, depth and height. If they pass, roundness is checked against threshold 0.8.

## 5. Why Does C Have Priority Over D?

Oversized or undersized items are operationally unsafe for the main line and must be diverted first. Therefore dimensions check precedes roundness.

## 6. How Is Synchronization Shown?

Cycle timeline shows state order, simulated timestamps, durations and status: done, active, pending or skipped.

## 7. How Does The Actuator Part Work?

The stop-gate fixes the item. B opens the gate, C extends pusher C, D extends pusher D, then mechanisms return home.

## 8. What Happens On Jam?

The system enters FAULT, conveyor target speed becomes 0, actual speed decays toward 0, and Reset is required.

## 9. What Happens On Low CV Confidence?

A warning is logged, but the system still classifies by deterministic dimensions and roundness rules.

## 10. How To Scale This To A Real Hardware-Software System?

Replace pseudo-CV with a CV service, connect PLC/robot telemetry via backend/WebSocket, persist event logs, calibrate sensor latencies and add recovery policies.
