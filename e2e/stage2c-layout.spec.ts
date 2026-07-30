import { test, expect } from '@playwright/test';

test.setTimeout(90_000);

test.describe('Stage 2C layout + measurement panel', () => {
  test('default / has no Measurement panel and canvas fills viewport height', async ({ page }) => {
    await page.goto('/?playback=paused');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Loading 3D'), {
      timeout: 60_000,
    });
    await page.waitForTimeout(500);

    await expect(page.locator('.cv-overlay')).toHaveCount(0);
    await expect(page.getByTestId('measurement-compact')).toHaveCount(0);

    const metrics = await page.evaluate(() => {
      const vh = window.innerHeight;
      const canvas = document.querySelector('canvas');
      const svg = document.querySelector('[data-testid="main-svg-fallback"]');
      const scene = canvas ?? svg;
      if (!scene) return { ok: false as const, reason: 'no scene' };
      const r = scene.getBoundingClientRect();
      const heightRatio = r.height / vh;
      const emptyBelow = Math.max(0, vh - (r.top + r.height));
      const emptyRatio = emptyBelow / vh;
      return {
        ok: true as const,
        heightRatio,
        emptyRatio,
        sceneTop: r.top,
        sceneHeight: r.height,
        vh,
      };
    });

    expect(metrics.ok).toBe(true);
    if (!metrics.ok) return;
    expect(metrics.heightRatio).toBeGreaterThanOrEqual(0.85);
    expect(metrics.emptyRatio).toBeLessThanOrEqual(0.2);
  });

  test('full Measurement panel only with debug=1&measurement=full', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?debug=1&playback=paused');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.cv-overlay:not(.cv-overlay-compact)')).toHaveCount(0);
  });
});
