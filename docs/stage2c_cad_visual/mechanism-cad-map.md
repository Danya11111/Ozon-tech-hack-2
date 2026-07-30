# Mechanism CAD Map — Stage 2C

## Author CAD nodes (conveer.FCStd → conveyor-web.glb)

| Group | Nodes (labels) | Role | Usable as junction paddle? |
|---|---|---|---|
| stop-gate | Барьер001, Барьер002 | Metering barriers on CAD module (~x CAD −0.8…−1.8 m) | No — wrong location/stroke for B/C/D junction |
| pusher-servo | Серво привод, Держатель-сервопривода, серво001, … | Side-mounted servo + holder on CAD module | Partial — REAL_CAD visual; no proven junction kinematics |
| motor-and-drive | NEMA17, шкивы, ремень | Drive at CAD module | Yes (drive only) |

## Junction sorting (x≈1.5 m, outside CAD module span)

CAD module world span X ≈ [−2.086, −0.076]. Domain junction / paddles live at x≈1.5 → **outside** author CAD solids.

**Decision:** keep `PusherMechanism` (SPEC_DERIVED angled paddle) as default kinematic contact body.
**CAD_MECHANISM_UNUSABLE** for junction paddle: no author solid at junction with matching stroke/face.

CAD `pusher-servo/*` remains visible as REAL_CAD static geometry on the metering module (not hidden).

## Contact events (runtime)

mechanismArmed → contactStarted → peakContactForce → contactEnded → physicsReleased → receiverEntered → itemSettled
(asserted in headless via pusher contact + receiver volumes; see drop-validation.json)
