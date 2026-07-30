# CAD Assembly Plan — Stage 2C

## Single source

Runtime group `SorterCadAssembly` (ConveyorBelt in SorterDigitalTwinContinuous):

1. `ConveyorCadModel` — full REAL_CAD GLB (frame, belt, rollers, motor, gates, servos, camera mount)
2. Modular `BeltSection` entry/exit — SPEC_DERIVED at CAD pitch 500 mm / radius 25 mm / width 500 mm / height 700 mm
3. End drive/tension rollers on extensions only
4. **No** procedural `StepperMotor`

## Parameters (`cadAssemblyParams.ts`)

segmentLength=2.01 m, rollerPitch=0.5 m, rollerRadius=0.025 m, conveyorWidth=0.5 m, beltHeight=0.7 m, supportSpacing=2.0 m, totalLineLength=8.5 m

## Forbidden

- Non-uniform scale of CAD module
- Duplicate full procedural conveyor
- Procedural motor alongside CAD NEMA17
