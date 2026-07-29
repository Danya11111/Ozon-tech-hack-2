#!/usr/bin/env node
/**
 * Stage 1 screenshot capture — 16 evidence images for docs/stage1_real_models/screenshots/.
 *
 * Requires a running app server (PLAYWRIGHT_BASE_URL or default http://127.0.0.1:3101).
 * 01-before-stage1-overview.png is copied from the pre-Stage-1 visual golden snapshot
 * (factual pre-change render from this same environment).
 */
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'docs/stage1_real_models/screenshots');
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3101';
mkdirSync(OUT, { recursive: true });

const shots = [];
async function snap(page, name) {
  const path = resolve(OUT, name);
  await page.screenshot({ path });
  shots.push(name);
  console.log(`captured ${name}`);
}

async function jumpCase(page, index) {
  const finished = page.getByTestId('demo-finished');
  if (await finished.isVisible().catch(() => false)) {
    await finished.getByRole('button', { name: /Replay/i }).click();
  }
  await page.getByTestId(`demo-case-${index}`).click();
  await page.getByTestId('demo-case-label').waitFor({ state: 'visible' });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (err) => console.error('PAGEERROR', err.message));

// 01 — before Stage 1 (pre-change golden snapshot from this environment)
copyFileSync(
  resolve(root, 'e2e/visual.spec.ts-snapshots/01-home-idle-hud-chromium-linux.png'),
  resolve(OUT, '01-before-stage1-overview.png'),
);
console.log('captured 01-before-stage1-overview.png (pre-Stage-1 golden snapshot)');

// 02 — overview with real products
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.getByTestId('demo-speed-2').click();
await jumpCase(page, 0);
await page.getByTestId('demo-category').waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
await snap(page, '02-real-products-overview.png');

// Route shots (B/C/D) with the real item paused mid-scene
const routes = [
  ['12-route-b-real-item.png', 0, 'B'],
  ['13-route-c-real-item.png', 2, 'C'],
  ['14-route-d-real-item.png', 4, 'D'],
];
for (const [name, idx, cat] of routes) {
  await jumpCase(page, idx);
  await page.getByTestId('demo-category').waitFor({ timeout: 30000 });
  const pause = page.getByTestId('demo-pause');
  if (await pause.isVisible().catch(() => false)) await pause.click();
  await page.waitForTimeout(800);
  await snap(page, name);
  console.log(`route ${cat} done`);
}

// Verification mode close-ups
async function verifyShot(name, sku, caseIdx) {
  await page.goto(`${BASE}/?stage1=1&verify=real-models&sku=${sku}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 60000 });
  await page.getByTestId('demo-play').first().click().catch(() => undefined);
  await jumpCase(page, caseIdx);
  await page.locator(`text=STAGE1 VERIFY · ${sku}`).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await snap(page, name);
}
await verifyShot('03-real-box-300.png', 'SKU-001', 0);
await verifyShot('04-real-box-400.png', 'SKU-004', 2);
await verifyShot('05-real-bottle.png', 'SKU-007', 5);
await verifyShot('06-real-plate.png', 'SKU-006', 4);
await verifyShot('07-real-lunchbox.png', 'SKU-002', 1);
await verifyShot('08-real-oversized-round.png', 'SKU-011', 6);
// SKU-005/SKU-008 are not in the demo playlist; verify overlays only appear for playing items.
await verifyShot('10-dimension-verification.png', 'SKU-006', 4); // plate: bbox + dims card
await verifyShot('11-pivot-and-contact-plane.png', 'SKU-009', 3); // pen: lying pivot + contact plane

// 09 — conveyor conversion blocked (honest technical evidence, not a misleading render)
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 60000 });
await page.waitForTimeout(2500);
await snap(page, '09-conveyor-conversion-blocked.png');

// 15 — /details with real item
await page.goto(`${BASE}/details`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 60000 });
await page.getByRole('button', { name: /start demo/i }).first().click();
await page.waitForTimeout(6000);
await page.locator('canvas').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await snap(page, '15-details-real-item.png');

// 16 — mobile SVG fallback after Stage 1 (viewport-driven, no special params)
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mob.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await mob.getByTestId('main-svg-fallback').waitFor({ timeout: 30000 });
await mob.waitForTimeout(1500);
const mobPath = resolve(OUT, '16-mobile-svg-fallback-after-stage1.png');
await mob.screenshot({ path: mobPath });
shots.push('16-mobile-svg-fallback-after-stage1.png');
console.log('captured 16-mobile-svg-fallback-after-stage1.png');

await browser.close();
console.log(`done: ${shots.length + 1} screenshots in ${OUT}`);
