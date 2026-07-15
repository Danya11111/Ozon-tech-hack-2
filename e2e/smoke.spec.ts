import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('home opens, canvas loads, play works', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');

    const loading = page.locator('.three-loading');
    const canvas = page.locator('canvas');
    await expect(loading.or(canvas).first()).toBeVisible({ timeout: 30_000 });
    await expect(canvas).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId('demo-hud')).toBeVisible();
    await expect(page.getByTestId('demo-play')).toBeVisible();

    await page.getByTestId('demo-play').click();
    await expect(page.getByTestId('demo-pause')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('demo-status')).not.toHaveText('FINISHED');

    const finished = page.getByTestId('demo-finished');
    if (await finished.isVisible().catch(() => false)) {
      await page.getByTestId('demo-play').click();
      await expect(finished).toBeHidden({ timeout: 10_000 });
      await expect(page.getByTestId('demo-pause')).toBeVisible({ timeout: 10_000 });
    }

    expect(pageErrors, `pageerrors: ${pageErrors.map((e) => e.message).join('; ')}`).toEqual([]);
  });
});
