import { test, expect, type Page, type Locator } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `missing box for ${locator}`).toBeTruthy();
  return box as Box;
}

function overlaps(a: Box, b: Box, pad = 0): boolean {
  return !(
    a.x + a.width + pad <= b.x ||
    b.x + b.width + pad <= a.x ||
    a.y + a.height + pad <= b.y ||
    b.y + b.height + pad <= a.y
  );
}

async function noHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(metrics.scrollWidth, 'documentElement horizontal overflow').toBeLessThanOrEqual(
    metrics.clientWidth + 1,
  );
  expect(metrics.bodyScrollWidth, 'body horizontal overflow').toBeLessThanOrEqual(
    metrics.clientWidth + 1,
  );
}

async function insideViewport(page: Page, locator: Locator) {
  const vp = page.viewportSize();
  expect(vp).toBeTruthy();
  const box = await boxOf(locator);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual((vp as { width: number }).width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual((vp as { height: number }).height + 1);
}

test.describe('responsive layout bbox', () => {
  test('desktop home: no control overlaps, no docs CTA', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?playback=paused');
    await expect(page.getByTestId('app-nav')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('main-docs-link')).toHaveCount(0);
    await expect(page.getByTestId('fallback-docs-link')).toHaveCount(0);

    const play = page.getByTestId('demo-play').or(page.getByTestId('demo-pause'));
    const present = page.getByTestId('demo-presentation');
    await expect(play).toBeVisible();
    await expect(present).toBeVisible();

    const playBox = await boxOf(play);
    const presentBox = await boxOf(present);
    expect(overlaps(playBox, presentBox)).toBe(false);

    const autoCam = page.getByTestId('auto-camera-toggle');
    if ((await autoCam.count()) > 0 && (await autoCam.isVisible())) {
      const autoBox = await boxOf(autoCam);
      expect(overlaps(playBox, autoBox)).toBe(false);
      expect(overlaps(presentBox, autoBox)).toBe(false);
      await insideViewport(page, autoCam);
    }

    await insideViewport(page, play);
    await insideViewport(page, present);
    await noHorizontalOverflow(page);
  });

  test('mobile home: sequential flow without overlaps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
      Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
    });
    await page.goto('/?playback=paused');

    await expect(page.getByTestId('main-mobile-stack')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('main-docs-link')).toHaveCount(0);
    await expect(page.getByTestId('fallback-docs-link')).toHaveCount(0);

    const nav = page.getByTestId('app-nav');
    const hud = page.getByTestId('demo-hud');
    const banner = page.getByTestId('fallback-reason');
    const diagram = page.getByTestId('fallback-diagram');
    const controls = page.getByTestId('main-controls');
    const play = page.getByTestId('demo-play').or(page.getByTestId('demo-pause'));
    const present = page.getByTestId('demo-presentation');

    await expect(nav).toBeVisible();
    await expect(hud).toBeVisible();
    await expect(banner).toBeVisible();
    await expect(diagram).toBeVisible();
    await expect(controls).toBeVisible();
    await expect(play).toBeVisible();
    await expect(present).toBeVisible();

    const navBox = await boxOf(nav);
    const hudBox = await boxOf(hud);
    const bannerBox = await boxOf(banner);
    const diagramBox = await boxOf(diagram);
    const controlsBox = await boxOf(controls);
    const playBox = await boxOf(play);
    const presentBox = await boxOf(present);

    expect(overlaps(navBox, hudBox)).toBe(false);
    expect(overlaps(hudBox, bannerBox)).toBe(false);
    expect(overlaps(diagramBox, controlsBox)).toBe(false);
    expect(overlaps(playBox, presentBox)).toBe(false);

    expect(navBox.y + navBox.height).toBeLessThanOrEqual(hudBox.y + 1);
    expect(hudBox.y + hudBox.height).toBeLessThanOrEqual(bannerBox.y + 1);
    expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(diagramBox.y + 8);
    expect(diagramBox.y + diagramBox.height).toBeLessThanOrEqual(controlsBox.y + 8);

    for (const loc of [nav, hud, play, present]) {
      const b = await boxOf(loc);
      // Tap target: at least one axis ≥ 40 (full-width buttons may be short in one dimension)
      expect(Math.max(b.width, b.height), 'min interactive size').toBeGreaterThanOrEqual(40);
      expect(Math.min(b.width, b.height), 'min interactive thickness').toBeGreaterThanOrEqual(40);
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(391);
    }

    // Empty gap check: banner→diagram gap should be modest (not the old ~210px pad)
    expect(diagramBox.y - (bannerBox.y + bannerBox.height)).toBeLessThan(48);

    await noHorizontalOverflow(page);
  });

  test('mobile documentation: single column + readable table wrapper', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/documentation');
    await expect(page.getByTestId('documentation-page')).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId('docs-toc-desktop')).toBeHidden();
    await expect(page.getByTestId('docs-toc-mobile')).toBeVisible();

    const fontSize = await page
      .locator('.docs-section p')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(15);

    const layoutDisplay = await page.locator('.docs-layout').evaluate((el) => getComputedStyle(el).display);
    expect(layoutDisplay).toBe('flex');

    const scroll = page.getByTestId('docs-table-scroll');
    await expect(scroll).toBeVisible();
    const overflowX = await scroll.evaluate((el) => getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflowX);

    await noHorizontalOverflow(page);
  });
});
