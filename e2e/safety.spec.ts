import { test, expect } from '@playwright/test';
import { ensureRunning, openPausedCase } from './helpers';

test.describe('safety', () => {
  test.setTimeout(90_000);

  test('jam case shows FAULT in status or command', async ({ page }) => {
    await openPausedCase(page, 10, '1');
    await expect(page.getByTestId('demo-case-label')).toHaveText('11/12');
    await ensureRunning(page);

    await expect
      .poll(
        async () => {
          const status = (await page.getByTestId('demo-status').textContent()) ?? '';
          const command = (await page.getByTestId('demo-command').textContent()) ?? '';
          return `${status} ${command}`;
        },
        { timeout: 20_000, intervals: [50, 100, 100] },
      )
      .toMatch(/FAULT/i);
  });

  test('emergency case shows EMERGENCY in status or command', async ({ page }) => {
    await openPausedCase(page, 11, '1');
    await expect(page.getByTestId('demo-case-label')).toHaveText('12/12');
    await ensureRunning(page);

    await expect
      .poll(
        async () => {
          const status = (await page.getByTestId('demo-status').textContent()) ?? '';
          const command = (await page.getByTestId('demo-command').textContent()) ?? '';
          return `${status} ${command}`;
        },
        { timeout: 20_000, intervals: [50, 100, 100] },
      )
      .toMatch(/EMERGENCY/i);
  });
});
