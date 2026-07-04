/**
 * Model Assets Manifest — real 3D models for product items.
 * Maps simulation items to real STL/GLB models from input_info.
 */

import type { Category, DimensionsMm } from '../domain/types';

export interface ModelAsset {
  /** Item ID from items.ts (e.g. 'SKU-006') */
  itemId: string;
  
  /** Display name (Russian) */
  displayName: string;
  
  /** Expected category scenario */
  categoryScenario: Category;
  
  /** Dimensions in mm */
  dimensions: DimensionsMm;
  
  /** Source file from input_info (for reference) */
  sourceFile: string;
  
  /** Frontend asset path (public/models or undefined if not used) */
  frontendAssetPath?: string;
  
  /** Loader type: 'stl' = use STLLoader, 'glb' = use GLTFLoader, 'procedural' = fallback primitive */
  loaderType: 'stl' | 'glb' | 'procedural';
  
  /** Fallback primitive shape if model fails to load */
  fallbackPrimitive: 'box' | 'cylinder' | 'sphere';
  
  /** Notes about why model is used/not used */
  notes?: string;
}

/**
 * Model assets manifest.
 * 
 * Strategy:
 * - Lightweight STL (< 700 KB): use directly with STLLoader.
 * - Heavy STL (> 1 MB): use procedural fallback, mark as "too heavy".
 * - Missing models: use procedural fallback.
 */
export const MODEL_ASSETS: ModelAsset[] = [
  {
    itemId: 'SKU-001',
    displayName: 'Короб 300×200×200',
    categoryScenario: 'B',
    dimensions: { width: 300, depth: 200, height: 200 },
    sourceFile: 'input_info/extracted/Stl/Короб 300х200х200.stl',
    frontendAssetPath: '/models/box-300.stl',
    loaderType: 'stl',
    fallbackPrimitive: 'box',
    notes: 'Lightweight STL (29 KB), used directly.',
  },
  {
    itemId: 'SKU-002',
    displayName: 'ЛанчБокс',
    categoryScenario: 'B',
    dimensions: { width: 201, depth: 152, height: 62 },
    sourceFile: 'input_info/extracted/Stl/ЛанчБокс.stl',
    frontendAssetPath: '/models/lunchbox.stl',
    loaderType: 'stl',
    fallbackPrimitive: 'box',
    notes: 'Medium STL (566 KB), acceptable for browser loading.',
  },
  {
    itemId: 'SKU-003',
    displayName: 'Моющее средство',
    categoryScenario: 'B',
    dimensions: { width: 259, depth: 179, height: 278 },
    sourceFile: 'input_info/extracted/Stl/Моющее средство.STL',
    frontendAssetPath: undefined,
    loaderType: 'procedural',
    fallbackPrimitive: 'box',
    notes: 'Heavy STL (3.5 MB), using fallback box to avoid performance impact.',
  },
  {
    itemId: 'SKU-004',
    displayName: 'Короб 400×400×300 (негабарит)',
    categoryScenario: 'C',
    dimensions: { width: 401, depth: 300, height: 400 },
    sourceFile: 'input_info/extracted/Stl/Короб 400х400х300.stl',
    frontendAssetPath: '/models/box-400.stl',
    loaderType: 'stl',
    fallbackPrimitive: 'box',
    notes: 'Lightweight STL (27 KB), used directly.',
  },
  {
    itemId: 'SKU-005',
    displayName: 'Пуфик',
    categoryScenario: 'C',
    dimensions: { width: 489, depth: 264, height: 489 },
    sourceFile: 'input_info/extracted/Stl/Пуфик.stl',
    frontendAssetPath: undefined,
    loaderType: 'procedural',
    fallbackPrimitive: 'cylinder',
    notes: 'Medium-heavy STL (629 KB), using fallback cylinder for soft bulky item representation.',
  },
  {
    itemId: 'SKU-006',
    displayName: 'Тарелка',
    categoryScenario: 'D',
    dimensions: { width: 210, depth: 209, height: 27 },
    sourceFile: 'input_info/extracted/Stl/Тарелка.stl',
    frontendAssetPath: '/models/plate.stl',
    loaderType: 'stl',
    fallbackPrimitive: 'cylinder',
    notes: 'Lightweight STL (123 KB), used directly. Round plate is visually distinctive.',
  },
  {
    itemId: 'SKU-007',
    displayName: 'Бутылка',
    categoryScenario: 'D',
    dimensions: { width: 91, depth: 91, height: 305 },
    sourceFile: 'input_info/extracted/Stl/Бутылка.stl',
    frontendAssetPath: '/models/bottle.stl',
    loaderType: 'stl',
    fallbackPrimitive: 'cylinder',
    notes: 'Medium STL (319 KB), acceptable. Bottle is visually recognizable.',
  },
  {
    itemId: 'SKU-008',
    displayName: 'Цилиндр',
    categoryScenario: 'D',
    dimensions: { width: 435, depth: 50, height: 43 },
    sourceFile: 'input_info/extracted/Stl/Цилиндр.stl',
    frontendAssetPath: '/models/cylinder.stl',
    loaderType: 'stl',
    fallbackPrimitive: 'cylinder',
    notes: 'Lightweight STL (106 KB), used directly.',
  },
  {
    itemId: 'SKU-009',
    displayName: 'Ручка',
    categoryScenario: 'C',
    dimensions: { width: 9, depth: 13, height: 148 },
    sourceFile: 'input_info/extracted/Stl/Ручка.stl',
    frontendAssetPath: undefined,
    loaderType: 'procedural',
    fallbackPrimitive: 'box',
    notes: 'Heavy STL (2.0 MB), using fallback thin box for pen representation.',
  },
  {
    itemId: 'SKU-010',
    displayName: 'Boundary box 450×320×320',
    categoryScenario: 'B',
    dimensions: { width: 450, depth: 320, height: 320 },
    sourceFile: 'N/A',
    frontendAssetPath: undefined,
    loaderType: 'procedural',
    fallbackPrimitive: 'box',
    notes: 'No STL available for boundary box, using procedural box.',
  },
  {
    itemId: 'SKU-011',
    displayName: 'Oversized round',
    categoryScenario: 'C',
    dimensions: { width: 500, depth: 300, height: 300 },
    sourceFile: 'N/A',
    frontendAssetPath: undefined,
    loaderType: 'procedural',
    fallbackPrimitive: 'cylinder',
    notes: 'No STL available for oversized round, using procedural cylinder.',
  },
];

/**
 * Get model asset for item ID.
 */
export function getModelAsset(itemId: string): ModelAsset | undefined {
  return MODEL_ASSETS.find((asset) => asset.itemId === itemId);
}

/**
 * Get all assets that use real STL models.
 */
export function getSTLAssets(): ModelAsset[] {
  return MODEL_ASSETS.filter((asset) => asset.loaderType === 'stl');
}

/**
 * Get all assets that use procedural fallbacks.
 */
export function getProceduralAssets(): ModelAsset[] {
  return MODEL_ASSETS.filter((asset) => asset.loaderType === 'procedural');
}

/**
 * Summary stats for manifest.
 */
export function getManifestStats() {
  const stlCount = getSTLAssets().length;
  const proceduralCount = getProceduralAssets().length;
  return {
    total: MODEL_ASSETS.length,
    stl: stlCount,
    procedural: proceduralCount,
    stlPercentage: Math.round((stlCount / MODEL_ASSETS.length) * 100),
  };
}
