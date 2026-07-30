# Physics Architecture — Hybrid Kinematic → Dynamic

## Authority model

Each item has a strict authority lifecycle:

```
kinematic (domain timeline drives pose: spawn → scan → junction)
   → handoff at route-specific instant (B: at B-spur; C/D: routing start at junction)
   → dynamic rigid body (Rapier: gravity, contacts, friction, restitution)
   → settle validation (inside receiver bounds, low |v|, low |ω|, min rest time)
   → freeze (sleep) → recycle for next case (explicit kinematic reset)
```

Components: `PhysicalPlaybackItemPhysics.tsx` (runtime),
`SorterPhysics.tsx` (world + fixed-step stepper + `physicsSimClock`),
`physicsWorldLayout.ts` (static colliders), `visualPhysicsProfiles.ts`
(per-SKU profiles), `physicsDropSim.ts` (headless mirror for validation).

## Determinism & lag robustness (Stage 2B hardening)

- Fixed timestep `PHYSICS_DT = 1/120`, max 8 substeps per frame; accumulator
  clamps spiral-of-death.
- **Physics clock**: `physicsSimClock.simSec` advances only when a Rapier step
  executes. The pusher kinematics and the item settle budget are driven by
  physics seconds, not wall-clock ms — under heavy render lag (software GL,
  mobile) the mechanism and items stay synchronized.
- **Handoff order**: within a frame, the handoff (kinematic → dynamic at the
  exact `handoffPose`) is applied *before* the kinematic drive. Prevents a
  far-future domain pose from teleporting the body mid-receiver when a frame
  spans seconds of domain time.
- **Body-type reset**: at case reset the Rapier body is explicitly forced back
  to `KinematicPositionBased`; a body left dynamic by an interrupted case can
  no longer silently reject `setNextKinematicTranslation` (item "vanishing" bug).
- CCD enabled for light items (< 0.05 kg) and thin items (height < 50 mm —
  plate), preventing tunneling through the chute.

## What is forbidden (and absent by construction)

No teleports, no hiding/showing items, no instantaneous position writes after
handoff, no freezing in air, no collision disabling, no forced corrections.
Freeze requires: inside receiver bounds + linear speed < 0.05 m/s +
angular speed < 0.5 rad/s + 0.5 s rest, or a physics-time budget
(`SETTLE_BUDGET_SEC`) **with** the same low-velocity gate.

## Static world (matches visible geometry)

- Belt slab (500 mm wide), B-spur flush with belt top (0.698 m — no 2 mm trip
  step), junction transfer plate 1000 mm wide at 21.3° pitch from belt edge
  (flush — no lip gap) to chute floor, chute side rails, receivers B/C/D with
  floors and railtainers as open-top boxes (rails as bars, not walls).
- Receivers: C at +z, D at −z, B along +x continuation. Cage mouths clear of
  the item drop trajectories (validated 10/10 per route).

## Drop validation (§16)

`scripts/drop-validation.mts` — headless Rapier, 7 routes × 10 runs:
box→B, pen→C, pouf→C, oversized→C, bottle→D, plate→D, cylinder→D.
Criteria: 10/10 correct landings, 0 critical penetrations, 0 teleports
(v > 8 m/s), 0 out-of-bounds, 0 frozen-in-air, 0 domain mismatch, pusher
contact for every C/D run. Result: `drop-validation.json` — **70/70 PASS**.

Unit coverage: `physicsDrop.test.ts`, `continuousMeasurement.test.ts`,
`physicalItemMotion.test.ts` (194 tests total).
