# Stage 2 — Real Sorter Simulation

Artifacts for the OZON Tech Sorter Simulation (CAD conveyor, continuous scan,
angled paddle physics, RealSense D435i, public deploy).

## Status

See `STAGE2_REPORT.md`. Current finalization status:
`PARTIAL_REAL_SORTER_SIMULATION` / `BLOCKED_BY_DEPLOYMENT_ACCESS` for the
permanent HTTPS hostname.

## Key files

| File | Purpose |
|---|---|
| `cad-inventory.json` | GLB path, 42 nodes, sizes |
| `cad-conversion-pipeline.md` | FCStd → Draco GLB |
| `mechanism-map.md` | Angled paddle diverter |
| `camera-realsense-spec.md` | D435i SPEC_DERIVED + FOV |
| `continuous-measurement.md` | Position-based scan window |
| `physics-architecture.md` | Hybrid kinematic → dynamic |
| `physics-profiles.json` | Per-SKU Rapier profiles |
| `drop-validation.json` | 7 routes × 10 runs |
| `real-sorter-validation.json` | Checklist results |
| `deployment-report.md` | Docker / DNS / tunnel |
| `public-domain-smoke.json` | Domain smoke facts |
| `console-errors.json` | Captured console state |
| `performance-cad-*.json` | Perf budgets |
| `bundle-impact.md` | Bundle sizes |
| `screenshots/` | 18 required views |
| `videos/` | Capture instructions (WebM pending real recorder) |

## Reproduce drop validation

```bash
npx tsx scripts/drop-validation.mts
```
