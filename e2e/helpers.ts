/** Shared e2e helpers — Stage 2B autostart means / opens already running. */
import { expect, type Page } from '@playwright/test';

/** Close the Demo Complete overlay if it is covering the controls. */
export async function dismissFinished(page: Page) {
  const finished = page.getByTestId('demo-finished');
  if (await finished.isVisible().catch(() => false)) {
    await finished.getByRole('button', { name: /Replay/i }).click({ force: true });
    await expect(finished).toHaveCount(0, { timeout: 10_000 });
  }
}

/** Ensure playback is running (noop if already on Pause button). */
export async function ensureRunning(page: Page) {
  await dismissFinished(page);
  const pause = page.getByTestId('demo-pause');
  if (await pause.isVisible().catch(() => false)) return;
  const play = page.getByTestId('demo-play');
  await expect(play.or(pause)).toBeVisible({ timeout: 15_000 });
  if (await play.isVisible().catch(() => false)) {
    await play.click({ force: true });
  }
  await expect(page.getByTestId('demo-pause')).toBeVisible({ timeout: 10_000 });
}

export async function ensurePaused(page: Page) {
  await dismissFinished(page);
  const play = page.getByTestId('demo-play');
  if (await play.isVisible().catch(() => false)) return;
  await page.getByTestId('demo-pause').click({ force: true });
  await expect(page.getByTestId('demo-play')).toBeVisible({ timeout: 10_000 });
}

/** Assert either Play or Pause control is present (autostart-safe). */
export async function expectPlaybackControl(page: Page) {
  await expect(
    page.getByTestId('demo-play').or(page.getByTestId('demo-pause')),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Open debug demo, pause, then seek to a case WHILE paused (seek preserves
 * paused status — unlike seek from idle which auto-starts).
 */
export async function openPausedCase(page: Page, caseIndex: number, speed: '0.5' | '1' | '1.5' | '2' = '1') {
  await page.goto('/?debug=1');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('demo-hud')).toBeVisible();
  await ensurePaused(page);
  await page.getByTestId(`demo-speed-${speed}`).click();
  await page.getByTestId(`demo-case-${caseIndex}`).click();
  await dismissFinished(page);
  await ensurePaused(page);
  await expect(page.getByTestId('demo-case-label')).toHaveText(`${caseIndex + 1}/12`);
}
