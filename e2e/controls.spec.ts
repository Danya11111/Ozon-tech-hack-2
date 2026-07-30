import { test, expect } from '@playwright/test';
import { dismissFinished, ensurePaused, ensureRunning, openPausedCase } from './helpers';

test.describe('controls', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await openPausedCase(page, 0, '1');
  });

  test('seek next/prev and jump cases, speed, presentation', async ({ page }) => {
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/12');

    await page.getByTestId('demo-next').click();
    await ensurePaused(page);
    await expect(page.getByTestId('demo-case-label')).toHaveText('2/12');

    await page.getByTestId('demo-prev').click();
    await ensurePaused(page);
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/12');

    await page.getByTestId('demo-case-8').click();
    await ensurePaused(page);
    await expect(page.getByTestId('demo-case-label')).toHaveText('9/12');

    await page.getByTestId('demo-case-0').click();
    await ensurePaused(page);
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/12');

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

    await page.goto('/?debug=1');
    await ensureRunning(page);
  });
});
