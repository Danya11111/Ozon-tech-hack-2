import { describe, it, expect } from 'vitest';
import {
  MODEL_ASSETS,
  getModelAsset,
  getSTLAssets,
  getProceduralAssets,
  getManifestStats,
} from './modelAssets';

describe('modelAssets', () => {
  describe('MODEL_ASSETS', () => {
    it('should contain assets for all scenario items', () => {
      const expectedIds = [
        'SKU-001',
        'SKU-002',
        'SKU-003',
        'SKU-004',
        'SKU-005',
        'SKU-006',
        'SKU-007',
        'SKU-008',
        'SKU-009',
        'SKU-010',
        'SKU-011',
      ];

      const actualIds = MODEL_ASSETS.map((asset) => asset.itemId);
      expectedIds.forEach((id) => {
        expect(actualIds).toContain(id);
      });
    });

    it('should have fallback primitive for every asset', () => {
      MODEL_ASSETS.forEach((asset) => {
        expect(asset.fallbackPrimitive).toMatch(/^(box|cylinder|sphere)$/);
      });
    });

    it('should have valid loader type for every asset', () => {
      MODEL_ASSETS.forEach((asset) => {
        expect(asset.loaderType).toMatch(/^(stl|glb|procedural)$/);
      });
    });

    it('should have frontendAssetPath only for stl/glb loaders', () => {
      MODEL_ASSETS.forEach((asset) => {
        if (asset.loaderType === 'procedural') {
          expect(asset.frontendAssetPath).toBeUndefined();
        } else {
          expect(asset.frontendAssetPath).toBeTruthy();
        }
      });
    });
  });

  describe('getModelAsset', () => {
    it('should return asset for valid item ID', () => {
      const asset = getModelAsset('SKU-006');
      expect(asset).toBeDefined();
      expect(asset?.displayName).toBe('Тарелка');
      expect(asset?.categoryScenario).toBe('D');
    });

    it('should return undefined for invalid item ID', () => {
      const asset = getModelAsset('SKU-999');
      expect(asset).toBeUndefined();
    });
  });

  describe('getSTLAssets', () => {
    it('should return only assets with loaderType stl', () => {
      const stlAssets = getSTLAssets();
      stlAssets.forEach((asset) => {
        expect(asset.loaderType).toBe('stl');
      });
    });

    it('should contain at least some STL assets', () => {
      const stlAssets = getSTLAssets();
      expect(stlAssets.length).toBeGreaterThan(0);
    });
  });

  describe('getProceduralAssets', () => {
    it('should return only assets with loaderType procedural', () => {
      const proceduralAssets = getProceduralAssets();
      proceduralAssets.forEach((asset) => {
        expect(asset.loaderType).toBe('procedural');
      });
    });
  });

  describe('getManifestStats', () => {
    it('should return correct totals', () => {
      const stats = getManifestStats();
      expect(stats.total).toBe(MODEL_ASSETS.length);
      expect(stats.stl).toBe(getSTLAssets().length);
      expect(stats.procedural).toBe(getProceduralAssets().length);
      expect(stats.stl + stats.procedural).toBe(stats.total);
    });

    it('should calculate correct percentage', () => {
      const stats = getManifestStats();
      expect(stats.stlPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.stlPercentage).toBeLessThanOrEqual(100);
      expect(stats.stlPercentage).toBe(Math.round((stats.stl / stats.total) * 100));
    });
  });
});
