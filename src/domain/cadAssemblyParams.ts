/**
 * Stage 2C — modular CAD conveyor assembly parameters.
 *
 * Derived from 3d_models/conveer.FCStd (manifest Body and Link bbox mm) and
 * OZON Track 3 layout (500 mm belt / 700 mm height). Extensions flanking the
 * ~2.01 m CAD module use the same pitch/width/height — never non-uniform scale.
 */

/** Author CAD module length after bake+placement (m). */
export const CAD_MODULE_LENGTH_M = 2.01;
/** CAD roller assembly pitch along the line (profiles / Link005 spacing ~500 mm). */
export const CAD_ROLLER_PITCH_M = 0.5;
/** CAD roller outer radius — Body002 roller diameter 50 mm. */
export const CAD_ROLLER_RADIUS_M = 0.025;
/** Spec / CAD belt width. */
export const CAD_CONVEYOR_WIDTH_M = 0.5;
/** Belt top height from floor. */
export const CAD_BELT_HEIGHT_M = 0.7;
/** Support leg spacing along extensions. */
export const CAD_SUPPORT_SPACING_M = 2.0;
/** Full domain line length (entry A to B spur tip), meters. */
export const CAD_TOTAL_LINE_LENGTH_M = 8.5;

export const CAD_ASSEMBLY_PARAMS = {
  segmentLength: CAD_MODULE_LENGTH_M,
  rollerPitch: CAD_ROLLER_PITCH_M,
  rollerRadius: CAD_ROLLER_RADIUS_M,
  conveyorWidth: CAD_CONVEYOR_WIDTH_M,
  beltHeight: CAD_BELT_HEIGHT_M,
  supportSpacing: CAD_SUPPORT_SPACING_M,
  totalLineLength: CAD_TOTAL_LINE_LENGTH_M,
} as const;

/** Structured correction transforms (bake is authoritative; JSX must not invent offsets). */
export const CAD_TRANSFORM_MANIFEST = {
  bakeFormula: '(x,y,z)_mm_Zup -> (-x, z, y+250)/1000 Y-up meters',
  worldPlacement: [-2.02, 0.594, 0] as [number, number, number],
  moduleSpanX: [-2.086, -0.076] as [number, number],
  motorNode: 'motor-and-drive/NEMA17',
  motorWorldAabbApprox: {
    min: [-2.062, 0.564, 0.212],
    max: [-2.02, 0.606, 0.284],
    note: 'On frame at belt height — not under floor. Detached motor was procedural StepperMotor.',
  },
} as const;
