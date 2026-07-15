import { test, expect } from '@playwright/test';

test.describe('controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('demo-hud')).toBeVisible();
  });

  test('seek next/prev and jump cases, speed, presentation', async ({ page }) => {
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');

    await page.getByTestId('demo-next').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('2/10');

    await page.getByTestId('demo-prev').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');

    await page.getByTestId('demo-case-8').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('9/10');

    await page.getByTestId('demo-case-0').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');

    for (const speed of ['0.5', '1', '1.5', '2'] as const) {
      await page.getByTestId(`demo-speed-${speed}`).click();
      await expect(page.getByTestId(`demo-speed-${speed}`)).toHaveClass(/active/);
    }

    await page.getByTestId('demo-presentation').click();
    await expect(page.getByTestId('demo-hud')).toBeHidden();
    await expect(page.locator('.presentation-exit')).toBeVisible();

    await page.locator('.presentation-exit').click();
    await expect(page.getByTestId('demo-hud')).toBeVisible();
    await expect(page.getByTestId('demo-presentation')).toBeVisible();
  });
});
