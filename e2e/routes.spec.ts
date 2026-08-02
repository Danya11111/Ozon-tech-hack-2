import { test, expect } from '@playwright/test';

test.describe('routes', () => {
  test('two-page UI: simulation, documentation, unknown redirect', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('app-nav').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('nav-simulation').first()).toHaveClass(/active/);

    await page.getByTestId('nav-documentation').first().click();
    await expect(page).toHaveURL(/\/documentation\/?$/);
    await expect(page.getByTestId('documentation-page')).toBeVisible();
    await expect(page.getByTestId('docs-production-status')).toContainText(
      'FINAL_ENGINEERING_PROTOTYPE_READY',
    );
    await expect(page.getByTestId('docs-production-status')).toContainText('WORKING_PROTOTYPE');
    await expect(page.getByTestId('nav-documentation').first()).toHaveClass(/active/);

    await page.reload();
    await expect(page).toHaveURL(/\/documentation\/?$/);
    await expect(page.getByTestId('documentation-page')).toBeVisible();

    await page.getByTestId('nav-simulation').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('demo-hud')).toBeVisible({ timeout: 60_000 });

    await page.goto('/details');
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/device-test');
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/old-route');
    await expect(page).toHaveURL(/\/$/);
  });
});
