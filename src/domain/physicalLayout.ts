/**
 * Physical Layout — единый источник правды для размеров 3D сцены.
 * Все размеры в метрах (1 Three.js unit = 1 meter).
 * 
 * Reference: OZON Track 3 specification
 * - Рабочая зона: 6000×10000 мм
 * - Конвейер: ширина 500мм, высота 700мм
 * - Скорость полотна: 1 м/с
 */

// =========================================================
// Workspace
// =========================================================
export const WORKSPACE_WIDTH_M = 6.0;
export const WORKSPACE_LENGTH_M = 10.0;

// =========================================================
// Conveyor dimensions (per OZON spec)
// =========================================================
export const CONVEYOR_WIDTH_M = 0.5;          // 500mm belt width
export const CONVEYOR_HEIGHT_M = 0.7;          // 700mm belt top surface from floor
export const CONVEYOR_SPEED_MPS = 1.0;         // 1 m/s belt speed
export const CONVEYOR_LENGTH_M = 8.5;          // Total belt length

// Belt structure
export const BELT_THICKNESS_M = 0.015;         // 15mm belt thickness
export const BELT_TOP_Y = CONVEYOR_HEIGHT_M;   // Top surface where items ride
export const BELT_BOTTOM_Y = CONVEYOR_HEIGHT_M - BELT_THICKNESS_M;

// Rollers (under/inside belt)
export const ROLLER_RADIUS_M = 0.04;           // 40mm radius
export const ROLLER_DIAMETER_M = ROLLER_RADIUS_M * 2;
export const ROLLER_SPACING_M = 0.15;          // 150mm between rollers
export const ROLLER_Y = BELT_BOTTOM_Y - ROLLER_RADIUS_M - 0.01; // Just below belt

// Frame structure
export const FRAME_HEIGHT_M = CONVEYOR_HEIGHT_M - BELT_THICKNESS_M - ROLLER_DIAMETER_M;
export const FRAME_WIDTH_M = 0.06;             // 60mm frame profile
export const SIDE_GUARD_HEIGHT_M = 0.08;       // 80mm side guards above belt
export const SIDE_GUARD_Y = BELT_TOP_Y + SIDE_GUARD_HEIGHT_M / 2;

// Support legs
export const LEG_WIDTH_M = 0.05;               // 50mm square legs
export const LEG_SPACING_M = 2.0;              // Every 2m

// =========================================================
// Motor drive
// =========================================================
export const MOTOR_WIDTH_M = 0.12;             // 120mm motor body
export const MOTOR_HEIGHT_M = 0.15;            // 150mm motor height
export const MOTOR_DEPTH_M = 0.08;             // 80mm motor depth
export const DRIVE_ROLLER_RADIUS_M = 0.06;     // 60mm drive roller

// =========================================================
// Zone positions (X axis = along conveyor, Z axis = lateral)
// Must be declared before other constants that reference it
// =========================================================
/**
 * Sorter module world-X origin (assembly moves as one unit).
 * Downstream hinges sit at origin + 1.55 m (module-local).
 */
export const SORTER_ASSEMBLY_ORIGIN_S = 0.40;
/** Canonical local sorter offsets (documented contract — not world X). */
export const DOCUMENTED_LOCAL_CONTACT_OFFSET = 1.0538;
export const DOCUMENTED_LOCAL_CLEAR_OFFSET = 1.6000;
/** Last physical upper-belt support X (matches belt-slab max bound). */
export const DISCHARGE_EDGE_S = 2.12;

export function worldContactPlaneS(): number {
  return SORTER_ASSEMBLY_ORIGIN_S + DOCUMENTED_LOCAL_CONTACT_OFFSET;
}
export function worldClearPlaneS(): number {
  return SORTER_ASSEMBLY_ORIGIN_S + DOCUMENTED_LOCAL_CLEAR_OFFSET;
}

export const ZONES = {
  /** Zone A - item spawn point (start of conveyor) */
  A: { x: -4.0, z: 0, label: 'A' },
  /** Camera/CV detection zone */
  CAMERA: { x: -1.5, z: 0 },
  /** Laser measurement zone */
  LASER: { x: -0.5, z: 0 },
  /** Gate/diverter position (downstream hinges of moved sorter assembly) */
  GATE: { x: SORTER_ASSEMBLY_ORIGIN_S + 1.55, z: 0 },
  /** Zone B - main sorter exit (straight discharge, past C/D lateral exit) */
  B: { x: 2.65, z: 0, label: 'B' },
  /** Zone C - oversized items (travel-left / +Z), aligned to guide exit */
  C: { x: SORTER_ASSEMBLY_ORIGIN_S + 1.55, z: 1.15, label: 'C' },
  /** Zone D - round items (travel-right / −Z), aligned to guide exit */
  D: { x: SORTER_ASSEMBLY_ORIGIN_S + 1.55, z: -1.15, label: 'D' },
} as const;

// =========================================================
// Stepper motor parameters (for length measurement)
// =========================================================
export const STEPPER_STEP_ANGLE_DEG = 1.8;     // 1.8° per full step (200 steps/rev)
export const MICROSTEP_DIVISOR = 16;           // 16x microstepping
export const STEPS_PER_REV = 360 / STEPPER_STEP_ANGLE_DEG * MICROSTEP_DIVISOR; // 3200 steps/rev
export const DRIVE_ROLLER_CIRCUMFERENCE_M = Math.PI * DRIVE_ROLLER_RADIUS_M * 2; // ~0.377m
export const MM_PER_STEP = (DRIVE_ROLLER_CIRCUMFERENCE_M * 1000) / STEPS_PER_REV; // ~0.118mm/step

// =========================================================
// Laser rangefinder (must be above max item)
// Stage 1: aligned to official ground truth 1150mm (docs/MEASUREMENT_SYSTEM_REPORT.md,
// OZON spec). Previously 1.4m. Measurement math is mount-height invariant
// (measuredHeight ≡ itemTop), so this changes no business result.
// =========================================================
export const LASER_HEIGHT_M = 1.15;           // Laser at 1.15m (official mount height)
export const LASER_POSITION_X = ZONES.CAMERA.x; // Co-located with camera

// =========================================================
// Stereo camera (must be above max item)
// =========================================================
export const STEREO_CAMERA = {
  baseline: 0.12,           // 120mm between lenses
  focalLength: 0.004,       // 4mm focal length
  fov: 60,                  // 60° field of view
  mountY: 1.35,             // Mounted at 1.35m (above max item)
};

// =========================================================
// Measurement zone
// =========================================================
export const MEASUREMENT_ZONE = {
  startX: ZONES.CAMERA.x - 0.4,
  endX: ZONES.CAMERA.x + 0.4,
  length: 0.8,              // 800mm measurement zone
};

// =========================================================
// Item dimension limits (per spec)
// =========================================================
export const MAX_ITEM_WIDTH_M = 0.45;         // 450mm max width
export const MAX_ITEM_DEPTH_M = 0.32;         // 320mm max depth
export const MAX_ITEM_HEIGHT_M = 0.32;        // 320mm max height (normal items)
export const OVERSIZE_DEMO_MAX_HEIGHT_M = 0.4; // 400mm for oversized demo items (C scenario)

// =========================================================
// Sensor rig clearance
// =========================================================
export const SENSOR_CLEARANCE_M = 0.25;       // 250mm clearance above tallest item
export const SENSOR_RIG_HEIGHT_M = BELT_TOP_Y + OVERSIZE_DEMO_MAX_HEIGHT_M + SENSOR_CLEARANCE_M; // ~1.35m

// =========================================================
// Roll cages (C/D destination bins)
// =========================================================
export const ROLL_CAGE = {
  width: 1.2,   // 1200mm
  depth: 0.8,   // 800mm
  height: 0.8,  // 800mm
  wheelRadius: 0.04,  // 40mm caster wheels
  frameThickness: 0.03, // 30mm frame tube
};

/** Interior floor height of the roll cage where items rest (just above wheels). */
export const CAGE_FLOOR_Y = ROLL_CAGE.wheelRadius * 2; // 0.08m

// =========================================================
// Physical surface widths (per OZON spec)
// =========================================================
export const MAIN_BELT_WIDTH_M = CONVEYOR_WIDTH_M; // 0.5m
export const CHUTE_C_WIDTH_M = 0.5;                 // 500mm chute
export const CHUTE_D_WIDTH_M = 0.5;                 // 500mm chute
export const CHUTE_SLOPE_START_Y = BELT_TOP_Y;      // 0.7m at junction
export const CHUTE_END_Y = CAGE_FLOOR_Y + 0.05;     // safe entry height into cage

/**
 * Canonical sorter junction — single world anchor for visual vanes, pivots,
 * colliders, activation trigger, and item passage math.
 *
 * Derived from runtime layout symbols (not screenshot guesswork):
 *  - central belt end / gate: ZONES.GATE
 *  - straight B spur start: B_RECEIVER.transferStartX (= GATE.x)
 *  - left chute entry (+Z / travel-left): GATE + half belt → ZONES.C
 *  - right chute entry (−Z / travel-right): GATE − half belt → ZONES.D
 *
 * Travel frame: +X forward, +Z = LEFT, −Z = RIGHT.
 */
export const JUNCTION = {
  x: ZONES.GATE.x,
  y: BELT_TOP_Y,
  z: ZONES.GATE.z,
  /** End of central belt / start of B spur (same X as GATE). */
  beltEndX: ZONES.GATE.x,
  /** Straight route entry (B transfer). */
  straightEntry: { x: ZONES.GATE.x, z: 0 },
  /** Physical left chute mouth (travel-left = +Z → category C). */
  leftEntry: { x: ZONES.GATE.x, z: MAIN_BELT_WIDTH_M / 2, category: 'C' as const },
  /** Physical right chute mouth (travel-right = −Z → category D). */
  rightEntry: { x: ZONES.GATE.x, z: -MAIN_BELT_WIDTH_M / 2, category: 'D' as const },
  /** Left diverter downstream hinge — CAD Барьер001 exit-side rail (+Z). */
  leftPivot: {
    x: 1.8661,
    y: BELT_TOP_Y + 0.062,
    z: 0.2878,
  },
  /** Right diverter downstream hinge — CAD Барьер002 exit-side rail (−Z). */
  rightPivot: {
    x: 1.3727,
    y: BELT_TOP_Y + 0.062,
    z: -0.2909,
  },
  rotation: [0, 0, 0] as [number, number, number],
  beltTopY: BELT_TOP_Y,
  centerline: { x: ZONES.GATE.x, z: 0 },
} as const;

/**
 * World X where an on-belt item first meets CAD swing diverters
 * (near upstream free-end of the shorter/right guide at rest).
 */
export const CAD_GATE_ENGAGE_X = JUNCTION.rightPivot.x - 0.75 + 0.08;

// =========================================================
// B receiving bin — отдельный промышленный контейнер на полу.
// НЕ продолжение конвейера: короткий transfer spur → drop chute → bin floor.
// Размер ~1.2×0.8×0.5 m (как C/D по footprint).
// =========================================================
export const B_RECEIVER = {
  // Closer than legacy 2.85, but opening starts after C/D leave the belt
  // so diverted items are not falsely captured by the B sensor volume.
  centerX: 2.65,
  centerZ: 0,
  width: 0.85,
  depth: 0.7,
  wallHeight: 0.45,
  floorY: CAGE_FLOOR_Y,
  transferStartX: DISCHARGE_EDGE_S + 0.05,
  transferEndX: DISCHARGE_EDGE_S + 0.12,
};

// =========================================================
// Item positioning and scaling
// =========================================================

/** Soft multiplier for visibility (max 1.15 for subtle enhancement) */
export const ITEM_VISIBILITY_MULTIPLIER = 1.0; // Use 1.0 for true physical scale

/**
 * Get rendered item dimensions in meters from mm dimensions.
 * Uses real physical scale (1 unit = 1 meter).
 * @param dimensionsMm - Dimensions in millimeters
 * @returns Dimensions in meters with optional visibility multiplier
 */
export function getRenderedItemDimensions(dimensionsMm: { width: number; depth: number; height: number }) {
  return {
    width: (dimensionsMm.width / 1000) * ITEM_VISIBILITY_MULTIPLIER,
    depth: (dimensionsMm.depth / 1000) * ITEM_VISIBILITY_MULTIPLIER,
    height: (dimensionsMm.height / 1000) * ITEM_VISIBILITY_MULTIPLIER,
  };
}

/**
 * Calculate item Y position so it sits ON the belt surface.
 * @param itemRenderedHeight - Rendered height of item in meters
 * @returns Y position for item center
 */
export function getItemYOnBelt(itemRenderedHeight: number): number {
  // Item center = belt top + half item height
  return BELT_TOP_Y + itemRenderedHeight / 2;
}

/**
 * Get standard item Y for small/medium items.
 * Most items are ~0.1-0.3m tall visually.
 */
export function getStandardItemY(): number {
  const averageItemHeight = 0.15; // 150mm average
  return getItemYOnBelt(averageItemHeight);
}

/**
 * Check if item height is within normal limits.
 */
export function isItemHeightNormal(heightMm: number): boolean {
  return heightMm <= MAX_ITEM_HEIGHT_M * 1000;
}

// =========================================================
// Camera rig (must be above max item height)
// =========================================================
export const CAMERA_RIG = {
  height: 1.5,           // 1.5m overhead frame (above max item)
  poleSpacing: 0.6,      // Poles 0.6m apart (outside belt)
  cameraY: 1.35,         // Camera at 1.35m (above max item)
};

// =========================================================
// Derived constants for legacy compatibility
// Details twin layout is derived in domain/layout/sharedLayout.ts
// =========================================================
export const CONVEYOR_POSITIONS = {
  spawnX: ZONES.A.x,
  cameraX: ZONES.CAMERA.x,
  laserX: ZONES.LASER.x,
  gateX: ZONES.GATE.x,
  zoneBX: ZONES.B.x,
  zoneCZ: ZONES.C.z,
  zoneDZ: ZONES.D.z,
  beltY: BELT_TOP_Y,
  itemOffsetY: 0.075, // Half of average item height
} as const;
