import { test, expect } from '@playwright/test';

/**
 * Production smoke — manual only:
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 EXPECTED_COMMIT=16e7930 npm run test:e2e:production
 */
test.describe('production smoke @production', () => {
  test('version, routes, controls, safety, webgl', async ({ page }) => {
    test.setTimeout(120_000);
    const expectedCommit = process.env.EXPECTED_COMMIT?.trim();
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

    const version = await page.evaluate(async () => {
      const r = await fetch('/version.json', { cache: 'no-store' });
      if (!r.ok) return null;
      return r.json();
    });
    expect(version, 'version.json missing').toBeTruthy();
    expect(version.commit).toMatch(/^[0-9a-f]{7,40}$/i);
    if (expectedCommit) {
      expect(version.commit).toBe(expectedCommit);
    }

    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    const webgl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { ok: false, renderer: null as string | null };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        ok: true,
        renderer: dbg
          ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string)
          : (gl.getParameter(gl.RENDERER) as string),
      };
    });
    expect(webgl.ok).toBe(true);

    await expect(page.getByTestId('demo-play').or(page.getByTestId('demo-pause'))).toBeVisible();
    await expect(page.getByTestId('demo-case-9')).toBeVisible();

    // Play / seek
    const pauseBtn = page.getByTestId('demo-pause');
    if (!(await pauseBtn.isVisible().catch(() => false))) {
      await page.getByTestId('demo-play').click();
    }
    await page.waitForTimeout(600);
    await page.getByTestId('demo-case-0').click();
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');

    // Jam
    await page.getByTestId('demo-speed-2').click();
    await page.getByTestId('demo-case-8').click();
    await expect
      .poll(async () => {
        const status = (await page.getByTestId('demo-status').textContent()) ?? '';
        const command = (await page.getByTestId('demo-command').textContent()) ?? '';
        return `${status} ${command}`;
      }, { timeout: 30_000 })
      .toMatch(/FAULT|JAM/i);

    // E-stop
    await page.getByTestId('demo-case-9').click();
    await expect
      .poll(async () => {
        const status = (await page.getByTestId('demo-status').textContent()) ?? '';
        const command = (await page.getByTestId('demo-command').textContent()) ?? '';
        return `${status} ${command}`;
      }, { timeout: 30_000 })
      .toMatch(/EMERGENCY/i);

    // Reset / recover toward case 0
    const stop = page.getByTestId('demo-stop');
    if (await stop.isVisible().catch(() => false)) {
      await stop.click({ force: true });
    }
    await page.getByTestId('demo-case-0').click({ force: true });
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');

    await page.goto('/details');
    await expect(page.locator('#root')).toBeVisible();
    await page.reload();
    await expect(page.locator('#root')).toBeVisible();

    // Back home — version still matches
    await page.goto('/');
    const version2 = await page.evaluate(async () => {
      const r = await fetch('/version.json', { cache: 'no-store' });
      return r.ok ? r.json() : null;
    });
    expect(version2?.commit).toBe(version.commit);

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    const critical = failed.filter((f) => !f.includes('favicon'));
    expect(critical, critical.join('\n')).toEqual([]);

    // Attach renderer for report (not a hard fail if software)
    test.info().annotations.push({
      type: 'webgl-renderer',
      description: webgl.renderer ?? 'unknown',
    });
  });
});
