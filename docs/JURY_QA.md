# Jury Q&A

## 1. Why Is This Not Just An Animation?

The animation is driven by a deterministic state machine, classifier, sensor state, actuator state, metrics and event log. The scene visualizes domain state instead of playing a decorative timeline.

## 2. How Is Classification Connected To The Actuator?

`classifyItem` returns B/C/D. The simulation maps that category to `ROUTE_TO_B`, `ROUTE_TO_C` or `ROUTE_TO_D`, which changes gate and pusher states and draws the physical route.

## 3. How Do You Prove The Route Was Correct?

The proof card shows category, reason and `ROUTE_TO_*`. The scene highlights the selected route arrow and zone B/C/D. Event Log in Engineering Details records state, command and item id.

## 4. Where Are OZON Rules Reflected?

The rules are explicit in classification limits: min/max dimensions, roundness threshold and C priority. Criteria Cards map these rules to scenarios. Full checklist is in Engineering Details.

## 5. How Does The Operator Safely Stop The System?

Open scenario **Аварийная остановка**. The system enters `EMERGENCY_STOP`, stops conveyor target speed and requires Reset.

## 6. What Happens On Sensor Failure Or Low Confidence?

Low confidence is logged as a warning. The system still applies deterministic dimensions/roundness rules as a fallback and shows this on the proof card.

## 7. Why 3D Digital Twin Without Physics Engine?

The main demo uses a lightweight React Three Fiber digital twin driven by the state machine (keyframe motion). A physics engine would add wasm weight and unpredictable collisions, which is worse for a live jury pitch. 2D SVG remains as fallback when WebGL is unavailable or on narrow mobile screens.

## 8. What Is Needed For A Physical Prototype?

Replace pseudo-CV with a real CV service, connect PLC/robot telemetry, calibrate sensor latencies, add hardware interlocks and persist event logs.

## 9. Where Is Computer Vision?

The MVP uses pseudo-CV: bbox, dimensions, confidence and latency are derived from mock items. The architecture keeps CV output separate from classification, so a real CV service can replace it later.

## 10. How Is Classification Correctness Proven?

The proof card shows dimensions, roundness and reason. Tests cover key boundary cases. Engineering Details has the full decision evidence and criteria checklist.

## 11. How Are Dimensions And Circular Section Handled?

Dimensions are checked first with exclusive official bounds: strictly greater than 10×10×10 mm and strictly less than 450×320×320 mm. If they pass, roundness K = r_in / R_out is checked: circular only when K > 0.8 (K = 0.8 is not round). Conveyor target speed is 1.00 m/s.

## 12. Why Does C Have Priority Over D?

Oversized or undersized items are operationally unsafe for the main line and must be diverted first. Therefore dimensions check precedes roundness.

## 13. How Is Synchronization Shown?

Storyline Stepper shows the active stage. In Engineering Details, Cycle Timeline shows state order, timestamps, durations and status: done, active, pending or skipped.

## 14. How Does The Actuator Part Work?

The stop-gate fixes the item. B opens the gate, C extends pusher C, D extends pusher D, then mechanisms return home.

## 15. What Happens On Jam?

Open scenario **Застревание**. The system enters FAULT, conveyor target speed becomes 0, actual speed decays toward 0, and Reset is required.

## 16. Why is the interface a Product Demo Page now?

To avoid cognitive overload during the pitch. The jury needs to understand the decision and see the route clearly without distraction from raw logs or PID graphs on the first screen.

## 17. How does the Demo prove engineering realism?

Even in the Product Demo Section, the scene and proof card are driven by the real state machine, classifier and metrics — not a pre-rendered video.

## 18. Where to see the full event log and PID?

Scroll to **Engineering Details** or click **Инженерный режим**. Open the section to see state machine, sensors, PID, timeline, event log and full criteria checklist.

## 19. How to check mobile and no horizontal scroll?

Use widths 1920×1080, 1440×900 and 390×844. On mobile the layout is one column, buttons are large, default view is 2D fallback. In console:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

## 20. How to show B / C / D / C-priority / fault in 3D?

- Normal item → green route B.
- Oversized → orange route C into roll-cage C.
- Round object → purple route D into roll-cage D.
- Oversized + round → still C (dimensions priority), D route stays inactive.
- Jam / emergency → red overlay, conveyor stopped, Reset required.

## 21. Where is the WebGL / FPS check?

Open Engineering Details → **3D capability check**.

## 22. Where Are The Test Object Models From input_info?

The official test set includes 11 STEP/STL models from input_info: Cylinder, Helmet, Bottle, Bag, Plate, Box 400×400×300, Lunchbox, Box 300×200×200, Pouf, Pen, Detergent. These models can be used to validate classification correctness on realistic geometries. The demo uses mock items derived from these dimensions and shapes.
