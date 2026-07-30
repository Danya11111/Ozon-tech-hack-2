# Sorting Mechanism Map — Angled Paddle Diverter

## Mechanism identification

The OZON Tech reference cell uses **angled paddle diverters** at the B/C/D
junction: a flat paddle mounted on a linear axis above the belt sweeps items
diagonally off the belt into the side chutes. Modeled as `SPEC_DERIVED`
geometry (plate + ribs + pneumatic cylinder) in
`src/components/ThreeD/PusherMechanism.tsx`; pure kinematics in
`src/domain/pusherMotion.ts`.

## Kinematic model (`PUSHER` constants)

| Parameter | Value | Note |
|---|---|---|
| Paddle half-extents | 0.5 × 0.14 × 0.025 m | 1000 mm wide paddle spans the junction |
| Center height | belt top + 0.142 m | 2 mm skirt clearance above belt surface |
| Stroke direction | (0.348, 0, ±0.937) normalized | diagonal: 1.62 m toward the chute center |
| Paddle yaw | atan2(0.348, 0.937) ≈ 20.4° | paddle face perpendicular to stroke |
| Engage point | (1.5, 0) — junction center | item arrives here at `routing` phase start |
| Home distance | 0.4 m behind engage | parked off-belt |
| Stroke speed | 1.0 m/s (extend), 2.0 m/s (retract) | |
| Timing | ARM 0.15 s → EXTEND 1.62 s → HOLD 0.15 s → RETRACT | phases: REST/ARMING/EXTENDING/CONTACT/HOLD/RETRACTING |

`getPusherState(category, routingElapsedSec) → { x, z, yaw, phase, speed }`.
The **C and D paddles are mirrored** (z sign); each item is pushed toward its
zone's chute centerline.

## Physics integration (contact-based handoff, §8/§9)

- The paddle is a **kinematic rigid body** (`kinematicPosition`, Rapier) with a
  cuboid collider (friction 0.15, polished steel). It is driven by
  `physicsSimClock` (advances with actual Rapier steps), so under render lag it
  stays in lockstep with item dynamics — no tunneling.
- Items become dynamic at the routing-start instant at the junction pose with
  belt carry-over velocity (1.0, 0, 0) m/s. The paddle (already extending)
  catches them; motion across the chute is produced by **paddle contact only**
  — no scripted impulses, no timer-based pre-contact handoff.
- Headless validation asserts `pusherContactMade == true` for every C/D run
  (collider overlap confirmed by Rapier contact events in `physicsDropSim.ts`).

## Visual <-> physics consistency

The visual paddle mesh is the same component that owns the kinematic body;
plate position/yaw per frame come from the same `getPusherState` call, so the
rendered paddle is exactly where the collider is. Chute colliders
(`physicsWorldLayout.ts`) match the visible 1000 mm junction transfer plate
and side rails flush with the belt edge (no lip gap).

Video: `videos/mechanism-contact.webm`; screenshots:
`09-mechanism-before-contact.png`, `10-mechanism-contact.png`.
