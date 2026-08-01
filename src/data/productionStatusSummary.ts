/**
 * Canonical summary data for `/documentation`.
 * Authority: official sources present in-repo → production code → unit tests.
 * Unverified / planned items are labeled explicitly — never implied complete.
 */

/** Kept for e2e (`docs-production-status`) and acquisition-pack provenance. */
export const PRODUCTION_STATUS = {
  acquisitionPackStatus: 'DATA_ACQUISITION_PACK_READY',
  webTwinStatus: 'BASELINE_PRESERVED',
  unitTests: '196/196',
  productionBuild: 'PASS',
  contactPhysics: 'NOT_FULLY_VALIDATED',
  officialCompliance: 'PARTIAL_SOURCES_PRESENT',
} as const;

export const CONFIRMED_LAYOUT = {
  workspaceMm: { length: 10000, width: 6000 },
  conveyorWidthMm: 500,
  conveyorHeightMm: 700,
  modules: ['clean', 'camera', 'sorter'] as const,
  receivers: ['B_STRAIGHT', 'ZONE_C', 'ZONE_D'] as const,
} as const;

export const CLASSIFIER_BOUNDS = {
  status: 'CURRENT_IMPLEMENTATION_VERIFIED_IN_CODE' as const,
  officialSourceReference: 'official_sources/doc-1783095831.pdf',
  officialSourceParsedThisPass: false,
  minExclusiveMm: { width: 10, depth: 10, height: 10 },
  maxExclusiveMm: { width: 450, depth: 320, height: 320 },
  roundnessThresholdExclusive: 0.8,
  display: {
    min: '> 10×10×10 мм',
    max: '< 450×320×320 мм',
    roundness: 'K > 0.8',
  },
  checkOrder: 'dimensions→C, else circular→D, else B' as const,
} as const;

export const ROUTE_MAPPING = [
  { category: 'B', physicalRoute: 'STRAIGHT', activeDiverter: 'NONE', signedAngleDeg: 0 },
  { category: 'C', physicalRoute: 'PHYSICAL_LEFT', activeDiverter: 'LEFT', signedAngleDeg: -45 },
  { category: 'D', physicalRoute: 'PHYSICAL_RIGHT', activeDiverter: 'RIGHT', signedAngleDeg: 45 },
] as const;

export const DIVERTER_KINEMATICS = {
  rotationDurationSec: 0.5,
  openingSafetyMarginSec: 0.15,
  contactPlaneS: 1.0538,
  clearPlaneS: 1.6,
  phases: ['READY', 'ARMED', 'OPENING', 'HOLDING', 'CLOSING'] as const,
  productBound: true,
  oneActiveProduct: true,
  closeAfterRearClear: true,
  generatedMechanismActive: false,
} as const;

export const CAD_PROVENANCE = {
  authorFcstd: '3d_models/conveer.FCStd',
  authorSha256: '90c1844a4ca05e26def783d6130fc4b993430dde14307534ef8fbb21c9fac2e6',
  runtimeGlb: 'public/models/sorter/conveyor-clean.glb',
  runtimeSha256: '1dc7a8d7891bfe756e277ad5368df74cb73410156b2fe0f92845afb8a56f285a',
  authorServosInSorterModule: true,
  generatedMechanismInactive: true,
  hornTransmissionInGlb: 'ABSENT_OR_INCOMPLETE' as const,
} as const;

export const PHYSICS_STATUS = {
  implemented: [
    'Runtime product motion on belt (domain pose + Rapier handoff)',
    'Product-associated diverter route timing (productId-bound)',
    'Synchronized CAD diverter visual / kinematic targets',
    'CCD enabled for light/thin SKUs in runtime and headless sim',
    'Visual/physics spawn gating via product asset preload',
  ],
  notFullyValidated: [
    'Complete contact-only routing through CAD diverters',
    'Belt surface velocity exactly 1 m/s with tangential drive',
    'Calibrated friction / mass / COM per SKU',
    'Fully physical continuous conveyor loop',
    'Receiver capture under all item classes',
  ],
  planned: [
    'Visual full belt loop with surface-velocity coupling',
    'Controlled tangential friction at 1 m/s',
    'Dynamic rigid bodies for divert segment with fixed timestep',
    'Per-SKU collider, damping, and friction profiles',
  ],
} as const;

export const VALIDATION_BOARD = [
  { item: 'Unit tests', status: '196/196 PASS' },
  { item: 'Production build', status: 'PASS' },
  { item: 'Active routes / + /documentation', status: 'PASS' },
  { item: 'conveyor-clean.glb checksum', status: 'PASS' },
  { item: 'Author FCStd checksum', status: 'PASS' },
  { item: 'Frozen diverter angles / 0.50 s', status: 'PASS' },
  { item: 'Full contact physics', status: 'NOT_FULLY_VALIDATED' },
] as const;

export const OFFICIAL_SOURCE_MATRIX = [
  {
    source: 'input_info/doc-1783009063.pdf',
    purpose: 'Allowed software list',
    present: true,
    canonical: true,
    usage: 'Stack compliance reference',
  },
  {
    source: 'input_info/doc-1783009942.pdf',
    purpose: 'Workspace / zone scheme',
    present: true,
    canonical: true,
    usage: 'Layout provenance (workspace 10×6 m)',
  },
  {
    source: 'input_info/doc-1783011400.pdf',
    purpose: 'Track 3 scoring criteria',
    present: true,
    canonical: true,
    usage: 'Jury scoring — not re-parsed this pass',
  },
  {
    source: 'input_info/doc-1782987706.zip',
    purpose: 'Official STEP product set',
    present: true,
    canonical: true,
    usage: 'Product geometry source archive',
  },
  {
    source: 'input_info/doc-1782987733.zip',
    purpose: 'Official STL product set',
    present: true,
    canonical: true,
    usage: 'Feeds public/models/*.stl',
  },
  {
    source: 'input_info/doc-1783011771.zip',
    purpose: 'Official pack archive',
    present: true,
    canonical: true,
    usage: 'Retained official material',
  },
  {
    source: 'official_sources/doc-1783095831.pdf',
    purpose: 'Classifier bounds authority cited by code',
    present: true,
    canonical: true,
    usage: 'Referenced by classifier.ts; not re-parsed this pass',
  },
  {
    source: 'input_info/extracted/Постановка_Задача_3_сжато_2.pdf',
    purpose: 'Full task brief (historical citation)',
    present: false,
    canonical: false,
    usage: 'MISSING — do not cite as available evidence',
  },
] as const;

export const RUNTIME_FLOW = [
  'SPAWN',
  'CONVEYOR',
  'CAMERA',
  'CLASSIFICATION',
  'ARMED',
  'OPENING',
  'HOLDING',
  'CLOSING',
  'RECEIVER',
] as const;

export const CURRENT_LIMITATIONS = [
  'Full physical contact sorting through CAD diverters is not fully validated.',
  'Belt surface-velocity drive at exactly 1 m/s is planned, not complete.',
  'Per-SKU physical parameters still require profiling/calibration.',
  'Author CAD horn / transmission incomplete in active GLB.',
  'Official compliance is partial: missing extracted task PDF; scoring PDF not re-parsed this pass.',
  'Repository retains only the web twin, author CAD, official sources, and active tests.',
] as const;

/** @deprecated alias — historical Gate wording retained for acquisition-pack note */
export const DATA_ACQUISITION_SEQUENCE = ['MEASURE', 'VERIFY', 'FREEZE', 'DESIGN'] as const;
