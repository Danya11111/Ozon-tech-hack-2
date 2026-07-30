# Continuous Measurement — No Stop Under the Camera

## Requirement (Stage 2B §6)

The item must not stop while passing the camera. Detection and measurement
happen *during* belt motion at the full 1.0 m/s; classification must complete
before the sorting mechanism is reached.

## Implementation

`getPhysicalItemPose` (`src/domain/physicalItemMotion.ts`) computes the item
position as a pure function of time: from spawn x = −2.2 m the item moves at
`CONVEYOR_SPEED_MPS = 1.0 m/s` continuously until the junction (x = 1.5 m).
The HUD phases are derived **from position**, not from timers that pause motion:

```
x < SCAN_START_X        → 'move_to_detection' / 'detection'
SCAN_START_X..SCAN_END_X → 'measurement' (scanProgress = (x − start)/span)
x > SCAN_END_X          → 'classification' → 'command_sent' → 'routing'
```

- `measurementZone.ts`: `SCAN_START_X = −0.31`, `SCAN_END_X = 0.41`
  (0.72 m window = real D435i vertical FOV footprint at 0.65 m optical height),
  `getScanProgress(x) → 0..1`, `getScanWindow(x)`.
- `CLASSIFICATION_DEADLINE_X = 0.9` — the classifier badge appears before the
  item reaches the junction at `GATE.x = 1.5` (0.6 m / 0.6 s of margin at
  1.0 m/s), well before mechanism contact.
- Belt velocity is constant through the scan zone: **no dwell anywhere**.
  Phase durations in `continuousPlayback.ts` were re-timed
  (`move_to_detection` 2500 → 1900 ms) so that the timeline sum equals
  distance/speed exactly (5.5 m at 1.0 m/s ⇒ 5.5 s from spawn to junction).
- `classifier.ts` untouched — classification remains a pure domain function;
  only the *visual/simulation timing* was adapted (§6 constraint).

## Tests (`src/domain/continuousMeasurement.test.ts`)

- Item x is **strictly increasing** through `detection` and `measurement`
  phases; implied belt velocity = 1.0 m/s at every sampled instant.
- `scanProgress` is position-based (0 at entry, 1 at exit, monotonic).
- Classification completes at `x ≤ CLASSIFICATION_DEADLINE_X` < junction.
- Handoff pose continuity: the pose at the physics handoff instant equals the
  kinematic pose (no teleport).

Screenshots: `07-continuous-scan-entry.png`, `08-continuous-scan-exit.png`,
`06-measurement-frustum-debug.png`; video: `videos/continuous-scan.webm`.
