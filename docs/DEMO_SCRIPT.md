# Demo Script

Open https://arhipovdan.ru/ and switch Header to `Guided Demo`.

## 30-Second Pitch

"We built an engineering simulation of the OZON sorting cell. It models the full loop: detection -> classification -> command -> routing. We cover happy paths to B/C/D, fault handling, and timing. The Guided Demo view shows the live proof."

## 3-Minute Guided Demo

1. Open **Guided Demo**.
2. Click **Start Guided Demo**.
3. Point to the **Current Proof Card** and the **Scene**.
   - "Watch how detection leads to classification and routing."
4. Click **Next** to show `Oversized item to C`.
   - "Dimensions fail first, priority C."
5. Click **Next** to show `Round object to D`.
   - "Dimensions pass, but roundness triggers D."
6. Click **Next** through `Boundary`, `Low confidence`, `Jam`, `Emergency stop`.
   - On faults: click "Apply fault scenario" to confirm.
   - "The line stops safely on emergency."

## 5-Minute Guided Demo

Use all 10 demo steps in Guided Demo View:

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

1. Read the **Demo Narration Card**.
2. Use **Next** or the **Primary Action Button**.
3. Point to the highlighted values in the **Proof Card**.
4. Read the **Presenter Phrase** from the screen.

## What to say on each step

Use the `presenterPhrase` text shown in the **Demo Narration Card**. It is specifically written to be short and clear for the jury.

## What to do if demo gets stuck

- Click **Reset Demo**.
- If still stuck, switch back to **Engineering Mode** and use manual scenario selection.
- Proceed manually.

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
