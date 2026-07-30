# Mechanism source search — Stage 2D

## Scope (read-only)

- Current working tree
- Local + remote branches (`git branch -a`)
- Git history (add/delete) for pusher/paddle/diverter/actuator/servo/mechanism/толкатель/заслонка
- `*.FCStd` / `*.step` / `*.stp` / archives under `input_info/` and `releases/`
- Git LFS listing

## Findings

| Source | Result |
|---|---|
| Author CAD | Only `3d_models/conveer.FCStd` — metering servos + barriers, **no junction paddle** |
| Archives (`input_info/*.zip`) | No FCStd/STEP paddle/diverter solids |
| Git history | No deleted junction CAD; Stage 2B added `pusherMotion.ts` + JSX `PusherMechanism` |
| Branches | No alternate FCStd mechanism on `main` / `dan_branch` / stage2 branches |
| LFS | Empty / unused for CAD |

## Conclusion

**Author REAL_CAD junction mechanism: MISSING.**

Stage 2D delivers **SPEC_DERIVED_CAD**:
- `3d_models/sorter_mechanism.step`
- `3d_models/sorter_mechanism.params.json`
- `public/models/sorter/mechanism-web.glb`
- Built by `tools/stage2d-mechanism/` from documented `PUSHER` dimensions

FreeCAD `.FCStd` binary not generated (FreeCAD package unavailable in environment). STEP + parametric JSON + GLB are the engineering CAD source.
