/**
 * Stage 2B artifact capture: 18 screenshots + 7 videos for docs/stage2_real_sorter/.
 * Run against the public production URL (tunnel) or preview:
 *   BASE=http://127.0.0.1:3101 node scripts/stage2b-capture.mjs shots
 *   BASE=https://<tunnel> node scripts/stage2b-capture.mjs all
 */
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3101';
const MODE = process.argv[2] ?? 'all';
const ROOT = new URL('../docs/stage2_real_sorter/', import.meta.url).pathname;
const SHOTS = `${ROOT}screenshots`;
const VIDEOS = `${ROOT}videos`;
for (const d of [SHOTS, VIDEOS]) mkdirSync(d, { recursive: true });

const DESKTOP = { width: 1280, height: 720 };
const shot = async (page, name) => {
  await page.evaluate(async () => {
    // 2 rAF + settle for deterministic WebGL frames
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 60));
  });
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64'));
  console.log('shot', name);
};

async function waitPhase(page, phase, timeout = 90_000) {
  await page.waitForFunction(
    (p) => document.querySelector('[data-testid="demo-phase"]')?.textContent?.trim() === p,
    phase, { timeout },
  );
}

async function waitStatus(page, re, timeout = 90_000) {
  await page.waitForFunction(
    (r) => new RegExp(r, 'i').test(
      `${document.querySelector('[data-testid="demo-status"]')?.textContent ?? ''} ${document.querySelector('[data-testid="demo-command"]')?.textContent ?? ''}`,
    ),
    re.source, { timeout },
  );
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  return { ctx, page };
}

async function waitScene(page, timeout = 120_000) {
  await page.waitForSelector('canvas', { timeout });
  await page.waitForSelector('[data-testid="demo-phase"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function shots(browser) {
  // 01 overview (clean UI, paused)
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?playback=paused`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await shot(page, '01-real-cad-overview');
    await ctx.close();
  }
  // 02 rollers close-up (B end), 03 brackets, 04/05 realsense, 16 premium wide
  const cams = [
    ['02-volumetric-rollers', '2.4,0.85,1.15,2.6,0.55,-0.1'],
    ['03-volumetric-brackets', '0.95,1.75,1.35,0.05,1.05,0'],
    ['04-realsense-front', '0.75,0.62,0.62,0.05,1.02,0'],
    ['05-realsense-mounted', '1.5,1.35,1.55,0.05,0.95,0'],
    ['16-premium-overview', '-3.6,2.3,3.4,0.4,0.45,0'],
  ];
  for (const [name, cam] of cams) {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?debug=1&camera=off&playback=paused&cam=${cam}`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await page.waitForTimeout(800);
    await shot(page, name);
    await ctx.close();
  }
  // 06 measurement frustum debug overlay (playing, measurement phase)
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?debug=1&physics=1`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await waitPhase(page, 'measurement');
    await shot(page, '06-measurement-frustum-debug');
    await ctx.close();
  }
  // 07/08 scan entry/exit (case 0 box_b)
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?debug=1`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await waitPhase(page, 'detection');
    await shot(page, '07-continuous-scan-entry');
    await waitPhase(page, 'classification');
    await shot(page, '08-continuous-scan-exit');
    await ctx.close();
  }
  // 09/10 mechanism before contact + contact (case 2 oversized_c)
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?debug=1`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await page.click('[data-testid="demo-case-2"]');
    await waitPhase(page, 'routing');
    await shot(page, '09-mechanism-before-contact');
    await page.waitForTimeout(700);
    await shot(page, '10-mechanism-contact');
    await ctx.close();
  }
  // 11 box B drop
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?debug=1`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await page.click('[data-testid="demo-case-0"]');
    await waitPhase(page, 'routing');
    await page.waitForTimeout(2100);
    await shot(page, '11-box-route-b');
    await ctx.close();
  }
  // 12 oversized C landing, 13 plate D, 14 cylinder D
  const drops = [
    ['12-oversized-route-c', 2, 1900],
    ['13-plate-route-d', 4, 1800],
    ['14-cylinder-route-d', 7, 1800],
  ];
  for (const [name, idx, delay] of drops) {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/?debug=1`, { waitUntil: 'domcontentloaded' });
    await waitScene(page);
    await page.click(`[data-testid="demo-case-${idx}"]`);
    await waitPhase(page, 'routing');
    await page.waitForTimeout(delay);
    await shot(page, name);
    await ctx.close();
  }
  // 15 real products scale comparison (details page stage1 grid)
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/details`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const grid = page.locator('[data-testid="stage1-model-grid"]');
    if (await grid.count()) {
      await grid.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await shot(page, '15-real-products-scale-comparison');
    } else {
      await shot(page, '15-real-products-scale-comparison');
    }
    await ctx.close();
  }
}

async function mobileShots(browser) {
  // 17 mobile on public domain (real mobile UA, weak signals → honest SVG tier here)
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const cdp = await ctx.newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${SHOTS}/17-mobile-public-domain.png`, Buffer.from(data, 'base64'));
    console.log('shot 17-mobile-public-domain');
    await ctx.close();
  }
  // 18 SVG fallback (Telegram WebView forces SVG tier)
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 Telegram-Android/10.12',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const cdp = await ctx.newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${SHOTS}/18-svg-fallback-public-domain.png`, Buffer.from(data, 'base64'));
    console.log('shot 18-svg-fallback-public-domain');
    await ctx.close();
  }
}

async function video(browser, name, url, script, durMs) {
  const ctx = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 1,
    recordVideo: { dir: '/tmp/stage2b-videos', size: DESKTOP },
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    await waitScene(page);
    await script(page);
  } catch (e) {
    console.log('video script warn', name, String(e).slice(0, 120));
  }
  await page.waitForTimeout(durMs);
  const v = page.video();
  await ctx.close();
  const path = await v.path();
  const { copyFileSync } = await import('node:fs');
  copyFileSync(path, `${VIDEOS}/${name}.webm`);
  console.log('video', name);
}

async function videos(browser) {
  const B = `${BASE}/?debug=1`;
  await video(browser, 'continuous-scan', B, async (page) => {
    await waitPhase(page, 'classification', 120_000);
  }, 1500);
  await video(browser, 'mechanism-contact', B, async (page) => {
    await page.click('[data-testid="demo-case-2"]');
    await waitPhase(page, 'routing', 120_000);
    await page.waitForTimeout(2500);
  }, 1500);
  await video(browser, 'route-b', B, async (page) => {
    await page.click('[data-testid="demo-case-0"]');
    await waitPhase(page, 'clear_gap', 150_000);
  }, 2000);
  await video(browser, 'route-c', B, async (page) => {
    await page.click('[data-testid="demo-case-2"]');
    await waitPhase(page, 'clear_gap', 150_000);
  }, 2500);
  await video(browser, 'route-d', B, async (page) => {
    await page.click('[data-testid="demo-case-4"]');
    await waitPhase(page, 'clear_gap', 150_000);
  }, 2500);
  await video(browser, 'jam', B, async (page) => {
    await page.click('[data-testid="demo-speed-2"]').catch(() => undefined);
    await page.click('[data-testid="demo-case-9"]');
    await waitStatus(page, /FAULT|JAM/i, 120_000);
  }, 2000);
  await video(browser, 'emergency-stop', B, async (page) => {
    await page.click('[data-testid="demo-speed-2"]').catch(() => undefined);
    await page.click('[data-testid="demo-case-10"]');
    await waitStatus(page, /EMERGENCY/i, 120_000);
  }, 2000);
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
if (MODE === 'shots' || MODE === 'all') await shots(browser);
if (MODE === 'mobile' || MODE === 'all') await mobileShots(browser);
if (MODE === 'videos' || MODE === 'all') await videos(browser);
await browser.close();
console.log('DONE', MODE);
