# REPLAY_RESOURCE_STABILITY

Measured: 2026-07-15T22:18:59.976Z
Verdict: **STABLE**

| Cycle | Heap MB | Geometries | Textures | Programs | Canvas |
| ----: | ------: | ---------: | -------: | -------: | -----: |
| 0 (initial) | 14.5 | 147 | 1 | 4 | 1 |
| 1 (after_1_replays) | 14.5 | 147 | 1 | 4 | 1 |
| 3 (after_3_replays) | 14.5 | 147 | 1 | 4 | 1 |
| 5 (after_5_replays) | 14.5 | 147 | 1 | 4 | 1 |
| 10 (after_10_replays) | 14.5 | 147 | 1 | 4 | 1 |
| 10 (after_gc_pause) | 14.5 | 150 | 1 | 4 | 1 |

## Interpretation

- **STABLE** — no meaningful growth.
- **LAZY_ALLOCATION_PLATEAU** — early growth then flat (expected for first-seen assets).
- **POSSIBLE_LEAK / CONFIRMED_LEAK** — investigate dispose paths.

Raw: `agent/reports/replay-stability.json`
