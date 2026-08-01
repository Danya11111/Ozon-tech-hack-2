import { test, expect } from '@playwright/test';
import { ensureRunning } from './helpers';

/**
 * Stage 0 — mobile fallback & WebGL context resilience.
 *
 * Covers:
 *  - 390×844 viewport: honest SVG fallback (no false "WebGL not available");
 *  - UI never controls an invisible canvas on the fallback path;
 *  - WebGL truly unavailable → same honest fallback;
 *  - forced context loss → SVG fallback; context restore → one safe 3D retry;
 *  - prototype mode query params work and keep Auto Cam toggle truthful.
 */

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

/** Stage 2 §16: fallback tests emulate a WEAK device (capable phones get Mobile Low 3D). */
async function stubWeakDevice(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
  });
}

function collectErrors(page: import('@playwright/test').Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

test.describe('mobile fallback (390x844)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    userAgent: MOBILE_UA,
    isMobile: true,
    hasTouch: true,
  });

  test('shows honest SVG fallback, no false WebGL error, UI stays functional', async ({ page }) => {
    const { pageErrors, consoleErrors } = collectErrors(page);
    await stubWeakDevice(page);

    await page.goto('/');

    // SVG fallback visible — never a blank black area
    const fallback = page.getByTestId('main-svg-fallback');
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await expect(fallback.locator('svg.sorter-svg')).toBeVisible();

    // Honest lightweight-mode badge, in Russian, no false claims
    const badge = page.getByTestId('fallback-reason');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Облегчённый режим');

    // The old misleading message must be gone (both languages)
    await expect(page.locator('text=WebGL not available')).toHaveCount(0);
    await expect(page.locator('text=Please use a modern browser')).toHaveCount(0);

    // No invisible canvas is being "controlled" — there is no canvas at all
    await expect(page.locator('canvas')).toHaveCount(0);

    // Auto-camera toggle must not claim hidden 3D works
    await expect(page.locator('.auto-camera-toggle')).toHaveCount(0);

    // Play/pause drive the visible SVG scene (same playback state).
    // Stage 2B autostart may already be running — ensureRunning is idempotent.
    await ensureRunning(page);
    await expect(page.getByTestId('demo-status')).not.toHaveText('FINISHED');
    await page.getByTestId('demo-pause').click();
    await expect(page.getByTestId('demo-play')).toBeVisible({ timeout: 10_000 });

    // Documentation via AppNav only (duplicate CTA removed)
    await expect(page.getByTestId('fallback-docs-link')).toHaveCount(0);
    await expect(page.getByTestId('main-docs-link')).toHaveCount(0);
    await page.getByTestId('nav-documentation').click();
    await expect(page).toHaveURL(/\/documentation/);

    // Stage 0 artifact
    await page.goto('/');
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'docs/stage0_premium_3d/screenshots/04-mobile-svg-fallback.png' });

    expect(
      pageErrors,
      `pageerrors: ${pageErrors.join('; ')}`,
    ).toEqual([]);
    expect(
      consoleErrors,
      `console errors: ${consoleErrors.join('; ')}`,
    ).toEqual([]);
  });
});

test.describe('webgl unavailable', () => {
  test('desktop without WebGL gets the same honest fallback', async ({ page }) => {
    const { pageErrors } = collectErrors(page);
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type.includes('webgl')) return null;
        return orig.call(this, type, ...rest) as RenderingContext | null;
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await page.goto('/');
    const fallback = page.getByTestId('main-svg-fallback');
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await expect(fallback.locator('svg.sorter-svg')).toBeVisible();
    await expect(page.getByTestId('fallback-reason')).toContainText('3D недоступно');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(pageErrors, `pageerrors: ${pageErrors.join('; ')}`).toEqual([]);
  });
});

test.describe('webgl context loss and recovery', () => {
  test('context loss shows fallback; restore performs one safe retry', async ({ page }) => {
    const { pageErrors } = collectErrors(page);
    await page.goto('/?perf=1');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    // Renderer fully initialized (perf collector live) before forcing loss
    await page.waitForFunction(() => typeof (window as never as { __PERF_SNAPSHOT__?: unknown }).__PERF_SNAPSHOT__ === 'object', null, { timeout: 15_000 });

    // Force a real GPU context loss through the extension on the same context.
    // NB: after loseContext() getExtension() returns null on the lost context,
    // so the extension handle is captured up front and reused for restore.
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) throw new Error('no canvas');
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) throw new Error('no webgl context');
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) throw new Error('WEBGL_lose_context unavailable');
      (window as unknown as { __loseExt: WEBGL_lose_context }).__loseExt = ext;
      ext.loseContext();
    });

    // Fallback appears with the context-loss badge
    const fallback = page.getByTestId('main-svg-fallback');
    await expect(fallback).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('fallback-reason')).toContainText('3D-сцена прервана');
    await page.screenshot({ path: 'docs/stage0_premium_3d/screenshots/07-context-loss-fallback.png' });

    // Canvas stays mounted (hidden) so a real restore can arrive.
    await expect(page.locator('canvas')).toHaveCount(1);

    // Restore the context — the app performs its single safe retry and 3D returns.
    await page.evaluate(() => {
      const ext = (window as unknown as { __loseExt?: WEBGL_lose_context }).__loseExt;
      if (!ext) throw new Error('extension handle missing');
      ext.restoreContext();
    });

    await expect(canvas.first()).toBeVisible({ timeout: 15_000 });
    await expect(fallback).toBeHidden();

    // A second loss after the consumed retry must park the fallback forever
    // (canvas unmounted, no error loop).
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return;
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await expect(fallback).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(0);

    // No uncaught errors may escape the boundary
    expect(pageErrors, `pageerrors: ${pageErrors.join('; ')}`).toEqual([]);
  });
});

test.describe('stage2 mobile capability policy', () => {
  test('capable phone gets Mobile Low 3D (no SVG fallback)', async ({ page }) => {
    const { pageErrors } = collectErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    });
    // prefer3DByDefault requires width >= 640; narrow 390px uses SVG by design.
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/?quality=low');
    // Mobile Low mounts the real 3D canvas at low quality
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('main-svg-fallback')).toHaveCount(0);
    await ensureRunning(page);
    await page.waitForTimeout(4000);
    expect(pageErrors, `pageerrors: ${pageErrors.join('; ')}`).toEqual([]);
  });

  test('Telegram WebView is forced to SVG until real-device verification', async ({ page }) => {
    const { pageErrors } = collectErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
      // iOS-style Telegram WebView marker
      (window as unknown as { TelegramWebviewProxy?: unknown }).TelegramWebviewProxy = { postEvent: () => undefined };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const fallback = page.getByTestId('main-svg-fallback');
    await expect(fallback).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(pageErrors, `pageerrors: ${pageErrors.join('; ')}`).toEqual([]);
  });
});

test.describe('stage0 prototype mode', () => {
  test('query params enable cinematic scene; auto cam toggle is truthful', async ({ page }) => {
    const { pageErrors, consoleErrors } = collectErrors(page);
    await page.goto('/?stage0=1&shadows=1&camera=1&post=0&perf=1');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 60_000 });

    // Perf collector active in prototype mode with perf=1
    await page.waitForFunction(() => typeof (window as never as { __PERF_SNAPSHOT__?: unknown }).__PERF_SNAPSHOT__ === 'object', null, { timeout: 15_000 });

    // Auto Cam toggle starts ON and reflects real state after click
    const toggle = page.locator('.auto-camera-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Auto Cam: ON');
    await toggle.click();
    await expect(toggle).toContainText('Auto Cam: OFF');
    await toggle.click();
    await expect(toggle).toContainText('Auto Cam: ON');

    await ensureRunning(page);
    await page.waitForTimeout(4000);
    expect(pageErrors, `pageerrors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  test('manual shot override keeps scene alive while paused', async ({ page }) => {
    const { pageErrors } = collectErrors(page);
    await page.goto('/?stage0=1&shadows=1&camera=1&shot=inspection&perf=1');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    // Paused playback + manual shot: camera controller must not crash
    await page.waitForTimeout(3000);
    expect(pageErrors, `pageerrors: ${pageErrors.join('; ')}`).toEqual([]);
  });
});
