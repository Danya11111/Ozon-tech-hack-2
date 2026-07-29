// Stage 2 visual verification screenshots (Linux-side Playwright).
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'docs/stage2_real_sorter/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto('http://localhost:3101/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /play demo|start demo/i }).first().click();

const snap = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('snap', name);
};

// overview during detection
await page.waitForTimeout(2500);
await snap('check-01-overview');

// wait for routing/drop of case 1 (SKU-001 -> B)
await page.waitForTimeout(6500);
await snap('check-02-routing');
await page.waitForTimeout(2500);
await snap('check-03-settled');

// drop results registry
const drops = await page.evaluate(() => window.__DROP_RESULTS ?? []);
console.log('DROP_RESULTS:', JSON.stringify(drops, null, 1));

await browser.close();
