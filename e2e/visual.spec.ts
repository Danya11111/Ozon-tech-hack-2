import { test, expect, type Page } from '@playwright/test';

test.setTimeout(90_000);

async function waitScene(page: Page) {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByTestId('demo-hud')).toBeVisible();
  // Demo auto-starts as running — pin speed early
  await page.getByTestId('demo-speed-2').click();
}

async function dismissFinishedIfNeeded(page: Page) {
  const finished = page.getByTestId('demo-finished');
  if (await finished.isVisible().catch(() => false)) {
    await finished.getByRole('button', { name: /Replay/i }).click();
    await expect(finished).toHaveCount(0);
  }
}

async function jumpCase(page: Page, index: number) {
  await dismissFinishedIfNeeded(page);
  await page.getByTestId(`demo-case-${index}`).click();
  await expect(page.getByTestId('demo-case-label')).toHaveText(`${index + 1}/10`, {
    timeout: 10_000,
  });
}

async function ensureRunning(page: Page) {
  await dismissFinishedIfNeeded(page);
  const pause = page.getByTestId('demo-pause');
  if (await pause.isVisible().catch(() => false)) return;
  await page.getByTestId('demo-play').click();
}

async function snapHud(page: Page, name: string) {
  await dismissFinishedIfNeeded(page);
  const hud = page.getByTestId('demo-hud');
  await expect(hud).toBeVisible();
  await expect(hud).toHaveScreenshot(name, {
    threshold: 0.35,
    maxDiffPixelRatio: 0.08,
  });
}

test.describe('visual regression', () => {
  test('01 home idle HUD', async ({ page }) => {
    await waitScene(page);
    // Pause for a stable idle-ish HUD
    const pause = page.getByTestId('demo-pause');
    if (await pause.isVisible().catch(() => false)) {
      await pause.click();
    }
    await expect(page.getByTestId('demo-case-label')).toHaveText('1/10');
    await snapHud(page, '01-home-idle-hud.png');
  });

  test('02 class B after seek case 0', async ({ page }) => {
    await waitScene(page);
    await jumpCase(page, 0);
    await ensureRunning(page);
    await expect(page.getByTestId('demo-category')).toHaveText('B', { timeout: 25_000 });
    await page.getByTestId('demo-pause').click().catch(() => undefined);
    await snapHud(page, '02-class-b-hud.png');
  });

  test('03 class C oversized case 2', async ({ page }) => {
    await waitScene(page);
    await jumpCase(page, 2);
    await ensureRunning(page);
    await expect(page.getByTestId('demo-category')).toHaveText('C', { timeout: 25_000 });
    await page.getByTestId('demo-pause').click().catch(() => undefined);
    await snapHud(page, '03-class-c-hud.png');
  });

  test('04 class D plate case 4', async ({ page }) => {
    await waitScene(page);
    await jumpCase(page, 4);
    await ensureRunning(page);
    await expect(page.getByTestId('demo-category')).toHaveText('D', { timeout: 25_000 });
    await page.getByTestId('demo-pause').click().catch(() => undefined);
    await snapHud(page, '04-class-d-hud.png');
  });

  test('05 jam fault HUD', async ({ page }) => {
    await waitScene(page);
    await jumpCase(page, 8);
    await ensureRunning(page);
    await expect
      .poll(async () => {
        const status = await page.getByTestId('demo-status').innerText();
        const cmd = await page.getByTestId('demo-command').innerText();
        return `${status} ${cmd}`;
      }, { timeout: 30_000 })
      .toMatch(/FAULT|JAM/i);
    await page.getByTestId('demo-pause').click().catch(() => undefined);
    await snapHud(page, '05-jam-fault-hud.png');
  });

  test('06 emergency stop HUD', async ({ page }) => {
    await waitScene(page);
    await jumpCase(page, 9);
    await ensureRunning(page);
    await expect
      .poll(async () => {
        const status = await page.getByTestId('demo-status').innerText();
        const cmd = await page.getByTestId('demo-command').innerText();
        return `${status} ${cmd}`;
      }, { timeout: 30_000 })
      .toMatch(/EMERGENCY/i);
    await page.getByTestId('demo-pause').click().catch(() => undefined);
    await snapHud(page, '06-emergency-hud.png');
  });

  test('07 presentation mode hides HUD', async ({ page }) => {
    await waitScene(page);
    await dismissFinishedIfNeeded(page);
    await page.getByTestId('demo-presentation').click();
    await expect(page.getByTestId('demo-hud')).toHaveCount(0);
    await expect(page.locator('.main-page')).toHaveScreenshot('07-presentation-mode.png', {
      threshold: 0.4,
      maxDiffPixelRatio: 0.12,
      animations: 'disabled',
    });
  });

  test('08 details engineering page', async ({ page }) => {
    await page.goto('/details');
    await expect(page.locator('#root')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('08-details-page.png', {
      threshold: 0.4,
      maxDiffPixelRatio: 0.12,
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('09 recovery after jam stop', async ({ page }) => {
    await waitScene(page);
    await jumpCase(page, 8);
    await ensureRunning(page);
    await expect
      .poll(async () => {
        const status = await page.getByTestId('demo-status').innerText();
        const cmd = await page.getByTestId('demo-command').innerText();
        return `${status} ${cmd}`;
      }, { timeout: 30_000 })
      .toMatch(/FAULT|JAM/i);
    // Stop resets toward recovery
    const stop = page.getByTestId('demo-stop');
    if (await stop.isVisible().catch(() => false)) {
      await stop.click({ force: true });
    } else {
      await dismissFinishedIfNeeded(page);
      await page.getByTestId('demo-case-0').click();
    }
    await expect(page.getByTestId('demo-case-label')).toBeVisible();
    await snapHud(page, '09-recovery-hud.png');
  });

  test('10 perf overlay engineering snapshot', async ({ page }) => {
    await page.goto('/?perf=1&quality=demo');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    const overlay = page.locator('.perf-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await expect(overlay).toHaveScreenshot('10-perf-overlay.png', {
      threshold: 0.4,
      maxDiffPixelRatio: 0.15,
    });
  });
});
