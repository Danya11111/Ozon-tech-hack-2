// Stage 0 artifact capture: auto-camera screenshots (05 inspection, 06 route-c).
// Reuses the same headless-GPU flags as scripts/stage0-benchmark.mjs.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.STAGE0_BASE ?? 'http://127.0.0.1:3101';
const EXEC = process.env.CHROMIUM_PATH ??
  (existsSync('/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell')
    ? '/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell'
    : undefined);

const GPU_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl-egl',
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--disable-software-rasterizer',
  '--disable-vulkan-surface',
];

const SHOTS = [
  { file: 'docs/stage0_premium_3d/screenshots/05-auto-camera-inspection.png', url: `${BASE}/?stage0=1&shadows=1&camera=1&post=1&shot=inspection&hud=0` },
  { file: 'docs/stage0_premium_3d/screenshots/06-auto-camera-routing-c.png', url: `${BASE}/?stage0=1&shadows=1&camera=1&post=1&shot=route-c&hud=0` },
];

const browser = await chromium.launch({ headless: true, executablePath: EXEC, args: GPU_ARGS, timeout: 45_000 });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const glRenderer = await page.evaluate(() => 'pending');
  void glRenderer;
  for (const shot of SHOTS) {
    await page.goto(shot.url, { waitUntil: 'networkidle' });
    await page.locator('canvas').waitFor({ state: 'visible', timeout: 60_000 });
    // let the camera settle into the shot and a few frames render
    await page.waitForTimeout(6000);
    const renderer = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') ?? c.getContext('webgl'));
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    console.log(`${shot.file} renderer=${renderer}`);
    await page.screenshot({ path: shot.file });
  }
} finally {
  await browser.close();
}
