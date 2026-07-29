/**
 * Model Assets Manifest — единый источник сведений о 3D-ассетах товаров.
 *
 * Stage 1 (real models): каждая запись фиксирует происхождение (архив OZON,
 * файл, SHA-256), измеренный исходный bounding box, transform нормализации
 * (rotation → uniform mm→m scale → bottom-center pivot) и бюджеты.
 *
 * Source measurements: scripts/stage1-analyze-stl.mjs (см. docs/stage1_real_models/).
 * Decimation: scripts/stage1-decimate-stl.mjs (vertex clustering, воспроизводимо).
 * Validation: scripts/validate-real-models.mjs (НЕ редактировать статусы вручную).
 */

import type { Category, DimensionsMm } from '../domain/types';

export interface SourceBoundingBoxMm {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

export interface ModelAsset {
  /** Item ID from items.ts (e.g. 'SKU-006') */
  itemId: string;

  /** Display name (Russian, official test-set name) */
  displayName: string;

  /** Expected category scenario */
  categoryScenario: Category;

  /** Expected physical dimensions in mm (domain truth, items.ts) */
  dimensions: DimensionsMm;

  // ---------------- Provenance ----------------
  /** 'official-stl' = byte-identical archive file; 'official-stl-decimated' = derived from archive STL by reproducible decimation; 'none' = no official model */
  sourceType: 'official-stl' | 'official-stl-decimated' | 'none';
  /** Archive the source file came from (repo-relative) */
  sourceArchive: string | null;
  /** File name inside the archive */
  sourceFile: string | null;
  /** SHA-256 of the source file inside the archive */
  sourceSha256: string | null;

  // ---------------- Runtime asset ----------------
  /** Frontend asset path under public/ (null if no real asset) */
  runtimePath: string | null;
  /** SHA-256 of the runtime file */
  runtimeSha256: string | null;
  runtimeFormat: 'binary-stl' | null;
  /** Measured triangle count of the runtime file */
  triangleCount: number | null;
  /** Runtime file size */
  fileSizeBytes: number | null;

  // ---------------- Normalization ----------------
  /** Measured source STL bounding box (mm, source axes) */
  sourceBoundingBoxMm: SourceBoundingBoxMm | null;
  /** Expected size along world X/Y/Z AFTER rotation (orientation-aware, mm) */
  worldExpectedMm: { x: number; y: number; z: number } | null;
  /** Euler rotation (radians) applied in source mm space before scaling */
  rotation: [number, number, number];
  /** Human-readable axis/orientation decision */
  axisMapping: string;
  /** Pivot convention after normalization */
  pivotMode: 'bottom-center';
  /** Scale convention: source mm → scene meters, uniform */
  scaleMode: 'uniform-mm-to-m';

  // ---------------- Policy ----------------
  /** true = real model is the default; false = fallback is the default (honest marking) */
  defaultRealAsset: boolean;
  /** Fallback primitive for load failure / low mode */
  fallbackPrimitive: 'box' | 'cylinder' | 'sphere';
  /** Provenance of the runtime geometry */
  conversionStatus: 'original' | 'decimated-cell-1mm' | 'decimated-cell-2mm' | 'not-applicable';
  /** Filled by validate-real-models.mjs — never hand-edited */
  validationStatus: 'pending' | 'pass' | 'fail';
  /** Preload with the default playlist scene (budget-controlled) */
  preload: boolean;

  notes?: string;
}

const ARCHIVE_STL = 'input_info/doc-1782987733.zip';

/**
 * Model assets manifest.
 *
 * All runtime STLs are official OZON test-set models (or reproducible
 * decimations of them), units = mm, rendered with uniform 0.001 scale.
 * No silent substitutions: SKUs without an exact official model are marked
 * NO_EXACT_OFFICIAL_MODEL and use an honestly labelled procedural fallback.
 */
export const MODEL_ASSETS: ModelAsset[] = [
  {
    itemId: 'SKU-001',
    displayName: 'Короб 300×200×200',
    categoryScenario: 'B',
    dimensions: { width: 300, depth: 200, height: 200 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Короб 300х200х200.stl',
    sourceSha256: '4ac9046bdef5bad2e7e50062fea30ead9132ebb6bdf23edeceb1f61c276f6e38',
    runtimePath: '/models/box-300.stl',
    runtimeSha256: '4ac9046bdef5bad2e7e50062fea30ead9132ebb6bdf23edeceb1f61c276f6e38',
    runtimeFormat: 'binary-stl',
    triangleCount: 592,
    fileSizeBytes: 29684,
    sourceBoundingBoxMm: { min: [-150.5, 0, -100], max: [150.5, 200.5, 100], size: [301, 200.5, 200] },
    worldExpectedMm: { x: 300, y: 200, z: 200 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; Y-up, bottom at y=0 in source',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'box',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: true,
    notes: 'Official STL, byte-identical to archive (checksum match).',
  },
  {
    itemId: 'SKU-002',
    displayName: 'ЛанчБокс',
    categoryScenario: 'B',
    dimensions: { width: 201, depth: 152, height: 62 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/ЛанчБокс.stl',
    sourceSha256: '3ad0f231777e7fe1ac55ac55e40074baffc3561c1fe082bb50dd47161f5c5c99',
    runtimePath: '/models/lunchbox.stl',
    runtimeSha256: '3ad0f231777e7fe1ac55ac55e40074baffc3561c1fe082bb50dd47161f5c5c99',
    runtimeFormat: 'binary-stl',
    triangleCount: 11574,
    fileSizeBytes: 578784,
    sourceBoundingBoxMm: { min: [-100.499, -55.8, -76.2], max: [100.496, 6.5, 76.2], size: [200.995, 62.3, 152.4] },
    worldExpectedMm: { x: 201, y: 62, z: 152 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; source pivot below center — normalized to bottom-center',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'box',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: true,
    notes: 'Official STL. Lid-down container; bottom-center pivot baked at load.',
  },
  {
    itemId: 'SKU-003',
    displayName: 'Моющее средство',
    categoryScenario: 'B',
    dimensions: { width: 259, depth: 179, height: 278 },
    sourceType: 'official-stl-decimated',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Моющее средство.STL',
    sourceSha256: '9a8239c0d079084ff45337f88a7169df75ef010c445a87ad3a5746d11ab154dd',
    runtimePath: '/models/detergent.stl',
    runtimeSha256: '1b93c69affe0a7b5fe67973d3c9ca2d7ca7f3daace9b26e386ce7cd89b78da92',
    runtimeFormat: 'binary-stl',
    triangleCount: 29458,
    fileSizeBytes: 1472984,
    sourceBoundingBoxMm: { min: [28.316, 1.054, 0.019], max: [287.345, 279.218, 179.252], size: [259.029, 278.164, 179.232] },
    worldExpectedMm: { x: 259, y: 278, z: 179 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; source offset from origin — normalized to bottom-center',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'box',
    conversionStatus: 'decimated-cell-2mm',
    validationStatus: 'pending',
    preload: false,
    notes: 'Official STL decimated 72,752→29,458 tris (vertex clustering, cell 2mm) to fit the 1.5MB budget; bbox preserved within 0.24mm.',
  },
  {
    itemId: 'SKU-004',
    displayName: 'Короб 400×400×300 (негабарит)',
    categoryScenario: 'C',
    dimensions: { width: 401, depth: 300, height: 400 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Короб 400х400х300.stl',
    sourceSha256: '05c4ec56883f085e1dafc9bd43fb87ce9993071122e19983192b72120daa9f68',
    runtimePath: '/models/box-400.stl',
    runtimeSha256: '05c4ec56883f085e1dafc9bd43fb87ce9993071122e19983192b72120daa9f68',
    runtimeFormat: 'binary-stl',
    triangleCount: 536,
    fileSizeBytes: 26884,
    sourceBoundingBoxMm: { min: [-200.5, 0, -200], max: [200.5, 300.5, 200], size: [401, 300.5, 400] },
    worldExpectedMm: { x: 401, y: 300, z: 400 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; Y-up, bottom at y=0 in source',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'box',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: true,
    notes: 'Official STL, byte-identical to archive.',
  },
  {
    itemId: 'SKU-005',
    displayName: 'Пуфик',
    categoryScenario: 'C',
    dimensions: { width: 489, depth: 264, height: 489 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Пуфик.stl',
    sourceSha256: '1761f3b2d9e5781a11f09e868d2c14e59d3c03bd5f0c19a006f28648de9f66d1',
    runtimePath: '/models/pouf.stl',
    runtimeSha256: '1761f3b2d9e5781a11f09e868d2c14e59d3c03bd5f0c19a006f28648de9f66d1',
    runtimeFormat: 'binary-stl',
    triangleCount: 12880,
    fileSizeBytes: 644084,
    sourceBoundingBoxMm: { min: [-244.452, -126, -124.452], max: [244.452, 138, 364.452], size: [488.905, 264, 488.905] },
    worldExpectedMm: { x: 489, y: 264, z: 489 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; source center-offset pivot — normalized to bottom-center',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'cylinder',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: false,
    notes: 'Official STL, round soft pouf. 489mm width exceeds the 450mm gate limit on purpose (C scenario).',
  },
  {
    itemId: 'SKU-006',
    displayName: 'Тарелка',
    categoryScenario: 'D',
    dimensions: { width: 210, depth: 209, height: 27 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Тарелка.stl',
    sourceSha256: '9bd0fece5fca87951d9c05576f054d0f61da76b56f0ca1387ddcfce816b23f47',
    runtimePath: '/models/plate.stl',
    runtimeSha256: '9bd0fece5fca87951d9c05576f054d0f61da76b56f0ca1387ddcfce816b23f47',
    runtimeFormat: 'binary-stl',
    triangleCount: 2504,
    fileSizeBytes: 125284,
    sourceBoundingBoxMm: { min: [-104.755, -4.56, -104.793], max: [104.755, 21.967, 104.644], size: [209.511, 26.527, 209.437] },
    worldExpectedMm: { x: 210, y: 27, z: 209 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; Y-up',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'cylinder',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: true,
    notes: 'Official STL, round plate (D scenario).',
  },
  {
    itemId: 'SKU-007',
    displayName: 'Бутылка',
    categoryScenario: 'D',
    dimensions: { width: 91, depth: 91, height: 305 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Бутылка.stl',
    sourceSha256: '9a8c64f1c26a2f2e2539b5e283b36ca78158cb8d2f0f66d3201dbcc784417375',
    runtimePath: '/models/bottle.stl',
    runtimeSha256: '9a8c64f1c26a2f2e2539b5e283b36ca78158cb8d2f0f66d3201dbcc784417375',
    runtimeFormat: 'binary-stl',
    triangleCount: 6522,
    fileSizeBytes: 326184,
    sourceBoundingBoxMm: { min: [-45.7, 0, -45.659], max: [45.535, 305, 45.659], size: [91.235, 305, 91.318] },
    worldExpectedMm: { x: 91, y: 305, z: 91 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width, y→height, z→depth; Y-up, bottom at y=0 in source',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'cylinder',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: true,
    notes: 'Official STL, standing bottle (D scenario).',
  },
  {
    itemId: 'SKU-008',
    displayName: 'Цилиндр',
    categoryScenario: 'D',
    dimensions: { width: 435, depth: 50, height: 43 },
    sourceType: 'official-stl',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Цилиндр.stl',
    sourceSha256: '7aab451e1fd2154e4a2301e12642d17ccee62fc950dddf7de5e54c89453254e5',
    runtimePath: '/models/cylinder.stl',
    runtimeSha256: '7aab451e1fd2154e4a2301e12642d17ccee62fc950dddf7de5e54c89453254e5',
    runtimeFormat: 'binary-stl',
    triangleCount: 2152,
    fileSizeBytes: 107684,
    sourceBoundingBoxMm: { min: [-83, -19, -25], max: [352, 24, 25], size: [435, 43, 50] },
    worldExpectedMm: { x: 435, y: 43, z: 50 },
    rotation: [0, 0, 0],
    axisMapping: 'x→width (long axis, along travel), y→height, z→depth; source offset — normalized to bottom-center',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'cylinder',
    conversionStatus: 'original',
    validationStatus: 'pending',
    preload: false,
    notes: 'Official STL, long cylinder lying along the belt.',
  },
  {
    itemId: 'SKU-009',
    displayName: 'Ручка',
    categoryScenario: 'C',
    dimensions: { width: 9, depth: 13, height: 148 },
    sourceType: 'official-stl-decimated',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Ручка.stl',
    sourceSha256: '9c1d3b27b9a5e4f1e65a43ac953f74695bfa0d9550dd97963bfcb7bb39f38720',
    runtimePath: '/models/pen.stl',
    runtimeSha256: 'eb4baf50e4910c9be3eaa092da3720fe2d5dcfd0d9a056e4480af6b878561df5',
    runtimeFormat: 'binary-stl',
    triangleCount: 4800,
    fileSizeBytes: 240084,
    sourceBoundingBoxMm: { min: [36.143, 91.878, 53.556], max: [45.142, 105.031, 202.016], size: [8.999, 13.153, 148.46] },
    worldExpectedMm: { x: 148, y: 13, z: 9 },
    rotation: [0, Math.PI / 2, 0],
    axisMapping: 'DEMO ORIENTATION: lying. Source long axis Z(148) rotated to world X (along travel); world Y=13 (depth), world Z=9 (width). Domain height 148 is the pen LENGTH (standing interpretation in items.ts).',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: true,
    fallbackPrimitive: 'box',
    conversionStatus: 'decimated-cell-1mm',
    validationStatus: 'pending',
    preload: true,
    notes: 'Official STL decimated 40,926→4,800 tris (cell 1mm). Lying demo orientation: a 148mm pen cannot stand stably on a moving belt; documented per Stage 1 §12.',
  },
  {
    itemId: 'SKU-010',
    displayName: 'Boundary box 450×320×320',
    categoryScenario: 'B',
    dimensions: { width: 450, depth: 320, height: 320 },
    sourceType: 'none',
    sourceArchive: null,
    sourceFile: null,
    sourceSha256: null,
    runtimePath: null,
    runtimeSha256: null,
    runtimeFormat: null,
    triangleCount: null,
    fileSizeBytes: null,
    sourceBoundingBoxMm: null,
    worldExpectedMm: null,
    rotation: [0, 0, 0],
    axisMapping: 'n/a',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: false,
    fallbackPrimitive: 'box',
    conversionStatus: 'not-applicable',
    validationStatus: 'pending',
    preload: false,
    notes: 'NO_EXACT_OFFICIAL_MODEL — synthetic boundary-limit test case (exactly at 450×320×320 gate limit); no official counterpart exists in the OZON archives. Honest procedural box, dimension-accurate.',
  },
  {
    itemId: 'SKU-011',
    displayName: 'Oversized round 500×300×300',
    categoryScenario: 'C',
    dimensions: { width: 500, depth: 300, height: 300 },
    sourceType: 'none',
    sourceArchive: null,
    sourceFile: null,
    sourceSha256: null,
    runtimePath: null,
    runtimeSha256: null,
    runtimeFormat: null,
    triangleCount: null,
    fileSizeBytes: null,
    sourceBoundingBoxMm: null,
    worldExpectedMm: null,
    rotation: [0, 0, 0],
    axisMapping: 'n/a',
    pivotMode: 'bottom-center',
    scaleMode: 'uniform-mm-to-m',
    defaultRealAsset: false,
    fallbackPrimitive: 'cylinder',
    conversionStatus: 'not-applicable',
    validationStatus: 'pending',
    preload: false,
    notes: 'NO_EXACT_OFFICIAL_MODEL — no 500×300×300 round item in the official set. Previously reused cylinder.stl (silent substitution, removed in Stage 1). Honest procedural cylinder, dimension-accurate.',
  },
];

/**
 * Archive-only official models with no matching SKU in the app scenario set.
 * Listed for inventory completeness (not loaded at runtime).
 */
export const ARCHIVE_ONLY_MODELS = [
  {
    displayName: 'Мешок',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Мешок.stl',
    sourceSha256: '74b3118643c0cd06ed639da1513b6db1b8d6d0a38e708cf2f8393d69263cd97b',
    triangleCount: 21228,
    fileSizeBytes: 5675429,
    notes: 'ASCII STL, ~183×175×199mm. No SKU in the app scenario set.',
  },
  {
    displayName: 'Шлем',
    sourceArchive: ARCHIVE_STL,
    sourceFile: 'Stl/Шлем.stl',
    sourceSha256: '660429b26d576771cd02ff275b489dcb134b17bf83b0cab969f589b4d6f6192d',
    triangleCount: 55159,
    fileSizeBytes: 2758034,
    notes: '~280×297×356mm. No SKU in the app scenario set.',
  },
] as const;

/** Get model asset for item ID. */
export function getModelAsset(itemId: string): ModelAsset | undefined {
  return MODEL_ASSETS.find((asset) => asset.itemId === itemId);
}

/** Assets whose default is a real official model. */
export function getRealAssets(): ModelAsset[] {
  return MODEL_ASSETS.filter((asset) => asset.defaultRealAsset);
}

/** Assets whose default is the honest procedural fallback. */
export function getProceduralAssets(): ModelAsset[] {
  return MODEL_ASSETS.filter((asset) => !asset.defaultRealAsset);
}

/** Assets to preload with the default playlist scene. */
export function getPreloadAssets(): ModelAsset[] {
  return MODEL_ASSETS.filter((asset) => asset.preload && asset.runtimePath);
}

/** Summary stats for manifest. */
export function getManifestStats() {
  const real = getRealAssets().length;
  const procedural = getProceduralAssets().length;
  return {
    total: MODEL_ASSETS.length,
    real,
    procedural,
    realPercentage: Math.round((real / MODEL_ASSETS.length) * 100),
  };
}
