import { test, expect } from '@playwright/test';

test.describe('routes', () => {
  test('/details opens, refresh stays, back to home', async ({ page }) => {
    await page.goto('/details');
    await expect(page).toHaveURL(/\/details\/?$/);
    await expect(page.getByRole('link', { name: /back to full-screen demo/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.reload();
    await expect(page).toHaveURL(/\/details\/?$/);
    await expect(page.getByRole('link', { name: /back to full-screen demo/i })).toBeVisible();

    await page.getByRole('link', { name: /back to full-screen demo/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('demo-hud')).toBeVisible({ timeout: 60_000 });
  });
});
