/**
 * Canonical summary data for `/documentation`.
 * Authority: official sources present in-repo → production code → unit tests.
 * Unverified / planned items are labeled explicitly — never implied complete.
 */

export const PRODUCTION_STATUS = {
  projectStatus: 'FINAL_ENGINEERING_PROTOTYPE_READY',
  webTwinStatus: 'PRODUCTION_LIVE',
  cvStatus: 'WORKING_PROTOTYPE',
  cvLiveIntegrated: false,
  unitTests: '196/196',
  cvTests: 'PASS (no camera)',
  productionBuild: 'PASS',
  productionUrl: 'https://ozon-tech-sorter.ru',
  contactPhysics: 'NOT_FULLY_VALIDATED',
  officialCompliance: 'PARTIAL_SOURCES_PRESENT',
  canonicalBranch: 'main',
} as const;

export const SOLUTION_COMPONENTS = [
  'Web digital twin (https://ozon-tech-sorter.ru)',
  'Real CV working prototype (cv/, RealSense D415 + OpenCV)',
  'Physical experimental conveyor stand',
  'Author CAD (3d_models/conveer.FCStd)',
  'Official B/C/D classifier (web + CV, K > 0.8)',
  'Engineering documentation (/documentation)',
] as const;

export const CONFIRMED_LAYOUT = {
  workspaceMm: { length: 10000, width: 6000 },
  conveyorWidthMm: 500,
  conveyorHeightMm: 700,
  modules: ['clean', 'camera', 'sorter'] as const,
  receivers: ['B_STRAIGHT', 'ZONE_C', 'ZONE_D'] as const,
} as const;

export const CLASSIFIER_BOUNDS = {
  status: 'ALIGNED_WEB_AND_CV' as const,
  officialSourceReference: 'official_sources/doc-1783095831.pdf',
  officialSourceParsedThisPass: false,
  minExclusiveMm: { width: 10, depth: 10, height: 10 },
  maxExclusiveMm: { width: 450, depth: 320, height: 320 },
  roundnessThresholdExclusive: 0.8,
  display: {
    min: '> 10×10×10 мм',
    max: '< 450×320×320 мм',
    roundness: 'K > 0.8',
    exactBoundary: 'K = 0.8 → B (not circular), not D',
  },
  checkOrder: 'dimensions→C, else circular (K>0.8)→D, else B' as const,
} as const;

export const CV_PROTOTYPE = {
  path: 'cv/',
  status: 'WORKING_PROTOTYPE',
  hardware: 'Intel RealSense D415',
  software: 'Python + OpenCV (+ optional MQTT)',
  liveIntegrated: false,
  pipeline: [
    'depth frame',
    'segmentation',
    'object contour',
    'L×W×H',
    'roundness K',
    'B/C/D',
    'optional MQTT',
  ] as const,
  notes: [
    'CV works as a separate prototype under cv/ on main.',
    'CV is not connected directly to the live public website.',
    'Hardware live validation requires RealSense D415.',
    'No-camera unit tests and compileall run in CI/local verification.',
  ],
} as const;

export const PHYSICAL_STAND = {
  status: 'EXPERIMENTAL_PROTOTYPE',
  elements: [
    'Physical belt conveyor',
    'Camera mounting structure above the belt',
    'Intel RealSense D415',
    'Electronics / control nodes',
    'Experimental actuators and printed components',
  ] as const,
  purpose: 'Measurements, calibration, and hardware validation — not claimed as industrial end-to-end certified sorting.',
} as const;

export const ARCHITECTURE = {
  realPath: [
    'physical product',
    'RealSense D415',
    'OpenCV measurement',
    'classifier (K > 0.8)',
    'B/C/D result',
    'optional MQTT/controller',
  ] as const,
  digitalPath: [
    'digital product',
    'simulated measurement',
    'same classifier rules',
    'route command',
    'digital twin',
    'B/C/D receiver',
  ] as const,
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
    'Belt speed target 1.0 m/s; physics timestep 1/60 s',
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
    'Per-SKU collider, damping, and friction profiles',
  ],
} as const;

export const MOBILE_BEHAVIOR = {
  desktop: 'Interactive WebGL 3D digital twin',
  mobile:
    'Capability-based tier: WebGL when viable; SVG/2D lite fallback on low FPS / missing WebGL (not claimed as full 3D)',
} as const;

export const VALIDATION_BOARD = [
  { item: 'Web unit tests', status: '196/196 PASS' },
  { item: 'Production build', status: 'PASS' },
  { item: 'Focused E2E (/ + /documentation)', status: 'PASS' },
  { item: 'CV compileall', status: 'PASS' },
  { item: 'CV classify/geometry tests', status: 'PASS (no camera)' },
  { item: 'Production / and /documentation', status: 'PASS' },
  { item: 'conveyor-clean.glb checksum', status: 'PASS' },
  { item: 'Author FCStd checksum', status: 'PASS' },
  { item: 'Classifier K > 0.8 (web + CV)', status: 'ALIGNED' },
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
    usage: 'Referenced by classifier.ts and cv/classify.py',
  },
  {
    source: 'presentation/Owl_Prime_Ozon_Tech_Track_3_FINAL.pdf',
    purpose: 'Final presentation (10 slides)',
    present: true,
    canonical: true,
    usage: 'Single presentation PDF in repository',
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

export const REPOSITORY_LAYOUT = [
  'src/ — web digital twin',
  'cv/ — RealSense + OpenCV prototype',
  '3d_models/ — author CAD',
  'public/ — runtime GLB/STL/draco',
  'docs/ — engineering notes',
  'presentation/ — final PDF',
  'e2e/ + Vitest — tests',
  'Docker / nginx — deployment',
] as const;

export const CURRENT_LIMITATIONS = [
  'Engineering prototype, not an industrial-certified PAK.',
  'Real CV prototype is not live-integrated into the public website.',
  'Live camera mode requires Intel RealSense D415 hardware.',
  'Physical stand parameters still require calibration against the digital twin.',
  'Full physical contact sorting through CAD diverters is not fully validated.',
  'Belt surface-velocity drive at exactly 1 m/s is not fully validated.',
  'Author CAD horn / transmission incomplete in active GLB.',
  'Cloud presentation/video links for the platform form are provided separately by the team.',
] as const;
