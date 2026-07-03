# Demo Script

Open https://arhipovdan.ru/ and switch Header to `Presentation Mode`.

## 3-Minute Defense

### 0:00-0:25 — System Overview

Demo step: `System overview`.

Say: the system models the full loop: detection -> classification -> actuator command -> physical route.

Watch: engineering SVG scene, sensors, stop-gate, pushers and B/C/D routes.

### 0:25-0:55 — Normal Item To B

Demo step: `Normal item to B`.

Apply scenario, use `Run suggested action` or `Step state`.

Say: dimensions pass, roundness is below threshold, category B opens the gate and sends the item straight.

### 0:55-1:25 — Oversized To C

Demo step: `Oversized item to C`.

Say: dimensions fail first, so C has priority even before shape routing.

Watch: decision tree FAIL, `ROUTE_TO_C`, lower roll-cage.

### 1:25-1:55 — Round Object To D

Demo step: `Round object to D`.

Say: dimensions pass, but roundness >= 0.8, so the item goes to D for repack/shape issue.

### 1:55-2:25 — Fault And Safety

Demo step: `Jam / fault handling` or `Emergency stop`.

With Safe Demo ON, confirm the fault scenario intentionally.

Say: abnormal states stop conveyor motion and require Reset.

### 2:25-3:00 — Criteria Coverage

Demo step: `Performance and synchronization`, then focus criteria panel.

Say: this checklist maps every OZON criterion to scenario, component and doc evidence.

## 5-Minute Defense

Use all 10 demo steps:

1. System overview.
2. Normal item to B.
3. Oversized item to C.
4. Round object to D.
5. Boundary dimensions.
6. Low confidence fallback.
7. Close items queue.
8. Jam / fault handling.
9. Emergency stop.
10. Performance and synchronization.

For each step:

1. Read `What to watch`.
2. Apply recommended scenario.
3. Use `Step state` or `Run suggested action`.
4. Point to the highlighted focus area.
5. Close with the presenter phrase.

## Fallback If Domain Does Not Open

1. SSH to server.
2. Check local frontend:

```bash
curl -I http://127.0.0.1:3100/
```

3. Check Docker project:

```bash
docker compose -p owl -f /opt/arhipovdan/app/docker-compose.server.yml ps
```

4. If screenshots/video are prepared later, show them while explaining the same demo steps.

## What Each Screen Proves

- SVG scene proves physical route and actuator command.
- Classification panel proves why category B/C/D was selected.
- Timeline proves synchronization and step-by-step behavior.
- PID panel proves conveyor control-loop behavior.
- Event Log proves traceability.
- Criteria panel proves coverage of OZON evaluation points.
