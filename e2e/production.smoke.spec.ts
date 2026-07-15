import { test, expect } from '@playwright/test';

/**
 * Production smoke — run manually:
 *   PLAYWRIGHT_BASE_URL=https://arhipovdan.ru/ npm run test:e2e:production
 * or against the working tunnel / local prod:
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e:production
 */
test.describe('production smoke @production', () => {
  test('serves current app shell and demo controls', async ({ page }) => {
    const pageErrors: string[] = [];
    const failed: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes(new URL(page.url()).host)) {
        failed.push(`${r.status()} ${r.url()}`);
      }
    });

    await page.goto('/');
    const html = await page.content();
    const bundle = html.match(/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? '';
    expect(bundle).toMatch(/^index-/);
    expect(bundle).not.toBe('index-CCdZzxPJ.js');

    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('demo-play')).toBeVisible();
    await expect(page.getByTestId('demo-case-9')).toBeVisible();

    await page.getByTestId('demo-play').click();
    await page.waitForTimeout(800);
    await page.getByTestId('demo-case-8').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('9/10');

    await page.goto('/details');
    await expect(page.locator('#root')).toBeVisible();
    await page.reload();
    await expect(page.locator('#root')).toBeVisible();

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    const critical = failed.filter((f) => !f.includes('favicon'));
    expect(critical, critical.join('\n')).toEqual([]);
  });
});
