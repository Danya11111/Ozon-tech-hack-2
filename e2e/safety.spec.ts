import { test, expect } from '@playwright/test';

test.describe('safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('demo-hud')).toBeVisible();
    // Speed up to reach fault phases sooner
    await page.getByTestId('demo-speed-2').click();
  });

  test('jam case shows FAULT in status or command', async ({ page }) => {
    await page.getByTestId('demo-case-8').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('9/10');

    await expect
      .poll(
        async () => {
          const status = (await page.getByTestId('demo-status').textContent()) ?? '';
          const command = (await page.getByTestId('demo-command').textContent()) ?? '';
          return `${status} ${command}`;
        },
        { timeout: 25_000 },
      )
      .toMatch(/FAULT/i);
  });

  test('emergency case shows EMERGENCY in status or command', async ({ page }) => {
    await page.getByTestId('demo-case-9').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('10/10');

    await expect
      .poll(
        async () => {
          const status = (await page.getByTestId('demo-status').textContent()) ?? '';
          const command = (await page.getByTestId('demo-command').textContent()) ?? '';
          return `${status} ${command}`;
        },
        { timeout: 25_000 },
      )
      .toMatch(/EMERGENCY/i);
  });
});
