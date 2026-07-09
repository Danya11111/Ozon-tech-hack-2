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
export const ZONES = {
  /** Zone A - item spawn point (start of conveyor) */
  A: { x: -4.0, z: 0, label: 'A' },
  /** Camera/CV detection zone */
  CAMERA: { x: -1.5, z: 0 },
  /** Laser measurement zone */
  LASER: { x: -0.5, z: 0 },
  /** Gate/diverter position */
  GATE: { x: 1.5, z: 0 },
  /** Zone B - main sorter exit (end of main conveyor) */
  B: { x: 4.0, z: 0, label: 'B' },
  /** Zone C - oversized items (lateral) */
  C: { x: 2.0, z: 2.0, label: 'C' },
  /** Zone D - round items (lateral opposite) */
  D: { x: 2.0, z: -2.0, label: 'D' },
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
// =========================================================
export const LASER_HEIGHT_M = 1.4;            // Laser at 1.4m (above max item)
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
