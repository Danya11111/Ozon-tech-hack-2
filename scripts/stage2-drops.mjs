// Stage 2: run through the demo playlist and collect drop results per case.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:3101/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /play demo|start demo/i }).first().click();

// 2x speed to shorten wall time
const speedBtn = page.getByRole('button', { name: /1x|2x/ }).first();
if (await speedBtn.count()) { /* speed toggling optional */ }

const seen = new Set();
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(2000);
  const drops = await page.evaluate(() => window.__DROP_RESULTS ?? []);
  for (const d of drops) {
    if (!seen.has(d.caseId)) {
      seen.add(d.caseId);
      console.log(`DROP ${d.caseId} ${d.itemId} -> zone ${d.expectedZone} pos=(${d.finalPosition.map((v) => v.toFixed(2)).join(',')}) inside=${d.insideExpectedReceiver} timeout=${d.settledByTimeout}`);
    }
  }
  if (seen.size >= 9) break;
}
console.log('total drops:', seen.size);
await browser.close();
