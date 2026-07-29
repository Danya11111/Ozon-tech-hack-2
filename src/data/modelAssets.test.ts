import { describe, it, expect } from 'vitest';
import {
  MODEL_ASSETS,
  ARCHIVE_ONLY_MODELS,
  getModelAsset,
  getRealAssets,
  getProceduralAssets,
  getManifestStats,
} from './modelAssets';

// Runtime files under public/ (project convention: import.meta.glob instead of node:fs)
const RUNTIME_MODEL_FILES = Object.keys(
  import.meta.glob('../../public/models/*.stl', { eager: true, query: '?url', import: 'default' }),
).map((p) => p.replace(/^.*\/public/, ''));

describe('modelAssets (Stage 1 real-model manifest)', () => {
  describe('MODEL_ASSETS', () => {
    it('should contain assets for all scenario items', () => {
      const expectedIds = [
        'SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005', 'SKU-006',
        'SKU-007', 'SKU-008', 'SKU-009', 'SKU-010', 'SKU-011',
      ];
      const actualIds = MODEL_ASSETS.map((asset) => asset.itemId);
      expectedIds.forEach((id) => {
        expect(actualIds).toContain(id);
      });
    });

    it('should have a unique SKU per entry', () => {
      const ids = MODEL_ASSETS.map((asset) => asset.itemId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should define a fallback primitive for every asset', () => {
      MODEL_ASSETS.forEach((asset) => {
        expect(asset.fallbackPrimitive).toMatch(/^(box|cylinder|sphere)$/);
      });
    });

    it('should have valid expected dimensions for every asset', () => {
      MODEL_ASSETS.forEach((asset) => {
        expect(asset.dimensions.width).toBeGreaterThan(0);
        expect(asset.dimensions.depth).toBeGreaterThan(0);
        expect(asset.dimensions.height).toBeGreaterThan(0);
      });
    });

    it('runtime paths must exist on disk for every real asset', () => {
      for (const asset of MODEL_ASSETS) {
        if (asset.defaultRealAsset) {
          expect(asset.runtimePath, `${asset.itemId} runtimePath`).toBeTruthy();
          expect(
            RUNTIME_MODEL_FILES,
            `${asset.itemId} → ${asset.runtimePath} must exist in public/models`,
          ).toContain(asset.runtimePath);
        } else {
          expect(asset.runtimePath).toBeNull();
        }
      }
    });

    it('real assets must declare provenance (archive, file, sha256)', () => {
      for (const asset of getRealAssets()) {
        expect(asset.sourceArchive).toBe('input_info/doc-1782987733.zip');
        expect(asset.sourceFile).toBeTruthy();
        expect(asset.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(asset.runtimeSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(asset.sourceBoundingBoxMm).not.toBeNull();
        expect(asset.worldExpectedMm).not.toBeNull();
        expect(asset.triangleCount).toBeGreaterThan(0);
        expect(asset.fileSizeBytes).toBeGreaterThan(0);
      }
    });

    it('real assets use bottom-center pivot and uniform mm→m scale only', () => {
      for (const asset of getRealAssets()) {
        expect(asset.pivotMode).toBe('bottom-center');
        expect(asset.scaleMode).toBe('uniform-mm-to-m');
      }
    });

    it('must NOT silently substitute another model for a SKU', () => {
      // SKU-011 previously reused cylinder.stl — forbidden now.
      const sku011 = getModelAsset('SKU-011');
      expect(sku011?.defaultRealAsset).toBe(false);
      expect(sku011?.runtimePath).toBeNull();
      expect(sku011?.notes).toContain('NO_EXACT_OFFICIAL_MODEL');
    });
  });

  describe('official test-set coverage', () => {
    it('integrates the 9 official models that have matching SKUs', () => {
      const realIds = getRealAssets().map((a) => a.itemId).sort();
      expect(realIds).toEqual([
        'SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005',
        'SKU-006', 'SKU-007', 'SKU-008', 'SKU-009',
      ]);
    });

    it('marks SKUs without an exact official model honestly', () => {
      for (const id of ['SKU-010', 'SKU-011']) {
        const asset = getModelAsset(id);
        expect(asset?.defaultRealAsset).toBe(false);
        expect(asset?.notes).toContain('NO_EXACT_OFFICIAL_MODEL');
      }
    });

    it('documents archive-only official models (bag, helmet)', () => {
      const names = ARCHIVE_ONLY_MODELS.map((m) => m.displayName);
      expect(names).toContain('Мешок');
      expect(names).toContain('Шлем');
      ARCHIVE_ONLY_MODELS.forEach((m) => {
        expect(m.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      });
    });

    it('respects runtime file budgets (<= 1.5MB hard, <= 100k tris acceptable)', () => {
      for (const asset of getRealAssets()) {
        expect(asset.fileSizeBytes!, `${asset.itemId} file size`).toBeLessThanOrEqual(1.5 * 1024 * 1024);
        expect(asset.triangleCount!, `${asset.itemId} triangles`).toBeLessThanOrEqual(100_000);
      }
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

  describe('getManifestStats', () => {
    it('should return correct totals', () => {
      const stats = getManifestStats();
      expect(stats.total).toBe(MODEL_ASSETS.length);
      expect(stats.real).toBe(getRealAssets().length);
      expect(stats.procedural).toBe(getProceduralAssets().length);
      expect(stats.real + stats.procedural).toBe(stats.total);
      expect(stats.realPercentage).toBe(Math.round((stats.real / stats.total) * 100));
    });
  });
});
