# Demo Script

Target duration: 3-5 minutes.

## 1. Open The Dashboard

Open https://arhipovdan.ru/.

Explain that this is a 2D engineering simulation, not a decorative animation: the SVG scene shows a scaled work zone, conveyor dimensions, sensors, stop-gate, pushers and roll-cages.

## 2. Normal Flow

Select `Normal flow`, press `Start`.

Explain:

- item enters zone A;
- camera captures bbox;
- laser measures height;
- ultrasonic confirms gate position;
- gate holds item;
- classifier selects B/C/D;
- route command is shown on the scene;
- event log records the full cycle.

Question closed: can the system show a full sorting cycle end-to-end?

## 3. Step-By-Step Decision

Press `Reset`, then use `Step state`.

Explain each state in the timeline. Show that Step advances by logical state, not by arbitrary animation time.

Question closed: can the jury inspect synchronization and state transitions?

## 4. Oversized And Round Rules

Select `Oversized item`, step to classification.

Show decision tree:

- dimensions check fails;
- category C selected;
- roundness is lower priority because dimensions are checked first.

Then select `Round object` and show D when dimensions pass and roundness >= 0.8.

Question closed: how is classification proved?

## 5. Robustness Scenarios

Show `close_items`, `low_confidence`, `jam`, `emergency_stop`.

Explain:

- close items generate spacing warning and queue length;
- low confidence uses rule-based fallback;
- jam enters FAULT and stops conveyor;
- emergency stop enters EMERGENCY_STOP and requires Reset.

Question closed: what happens outside the happy path?

## 6. PID And Metrics

Point to PID panel and metrics cards.

Explain that PID is simplified: actual speed approaches target in normal flow and decays toward zero in fault/emergency.

Question closed: how is conveyor control represented without overbuilding physics?
