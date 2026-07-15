import { test, expect } from '@playwright/test';

test.describe('visual regression', () => {
  test('home idle HUD panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });

    const hud = page.getByTestId('demo-hud');
    await expect(hud).toBeVisible();
    // Wait for idle classification proof row / stable HUD text
    await expect(page.getByTestId('demo-command')).toHaveText('IDLE');
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');

    // Snapshot HUD only — avoids flaky WebGL canvas pixels
    await expect(hud).toHaveScreenshot('home-idle-hud.png', {
      threshold: 0.3,
      maxDiffPixelRatio: 0.05,
    });
  });
});
