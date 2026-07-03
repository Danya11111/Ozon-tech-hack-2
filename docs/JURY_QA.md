# Jury Q&A

## 1. Why Is This Not Just An Animation?

The animation is driven by a deterministic state machine, classifier, sensor state, actuator state, metrics and event log. The scene visualizes domain state instead of playing a decorative timeline.

## 2. How Is Classification Connected To The Actuator?

`classifyItem` returns B/C/D. The simulation maps that category to `ROUTE_TO_B`, `ROUTE_TO_C` or `ROUTE_TO_D`, which changes gate and pusher states and draws the physical route.

## 3. How Do You Prove The Route Was Correct?

The decision tree shows thresholds and PASS/FAIL, the scene shows the selected command and route arrow, and Event Log records state, command/category and item id.

## 4. Where Are OZON Rules Reflected?

The rules are explicit in classification limits: min/max dimensions, roundness threshold and C priority. Criteria Coverage maps these rules to scenarios and docs.

## 5. How Does The Operator Safely Stop The System?

The `emergency_stop` scenario enters `EMERGENCY_STOP`, stops conveyor target speed and requires Reset. In Presentation Mode, Safe Demo requires confirmation before fault scenarios.

## 6. What Happens On Sensor Failure Or Low Confidence?

Low confidence is logged as a warning. The system still applies deterministic dimensions/roundness rules as a fallback and shows this in the panel.

## 7. Why 2D, Not 3D?

2D is enough for MVP validation: it shows geometry, timing, sensor positions, routes and state transitions without spending effort on heavy rendering.

## 8. What Is Needed For A Physical Prototype?

Replace pseudo-CV with a real CV service, connect PLC/robot telemetry, calibrate sensor latencies, add hardware interlocks and persist event logs.

## 9. Where Is Computer Vision?

The MVP uses pseudo-CV: bbox, dimensions, confidence and latency are derived from mock items. The architecture keeps CV output separate from classification, so a real CV service can replace it later.

## 10. How Is Classification Correctness Proven?

The decision tree shows PASS/FAIL for dimensions and roundness, actual values, thresholds and final category. Tests cover key boundary cases.

## 11. How Are Dimensions And Circular Section Handled?

Dimensions are checked first against min/max width, depth and height. If they pass, roundness is checked against threshold 0.8.

## 12. Why Does C Have Priority Over D?

Oversized or undersized items are operationally unsafe for the main line and must be diverted first. Therefore dimensions check precedes roundness.

## 13. How Is Synchronization Shown?

Cycle timeline shows state order, simulated timestamps, durations and status: done, active, pending or skipped.

## 14. How Does The Actuator Part Work?

The stop-gate fixes the item. B opens the gate, C extends pusher C, D extends pusher D, then mechanisms return home.

## 15. What Happens On Jam?

The system enters FAULT, conveyor target speed becomes 0, actual speed decays toward 0, and Reset is required.

## 16. Why is the interface divided into Guided and Engineering?

Guided Demo is focused solely on the defense presentation, showing only the Proof Card, Scene, and Narrative, ensuring clarity in a 3-minute pitch. Engineering Mode provides full access to logs, PID, and internal state.

## 17. How does Guided Demo prove engineering realism?

Even in Guided Demo, the scene and proof card are driven by the real underlying state machine, classifier, and metric engine—not a pre-rendered video.

## 18. Where to see the full event log and PID?

In the Engineering Dashboard.

## 19. Why aren't all panels shown in Guided Demo?

To avoid cognitive overload during the pitch. The jury needs to understand the decision and see the route clearly without distraction from raw JSON logs or PID graphs.
