/**
 * Stage 2D — hardware GPU performance matrix runner.
 * Requires NVIDIA WebGL: --use-angle=vulkan (or gl-egl).
 *
 * Usage:
 *   npx tsx scripts/stage2d-perf-matrix.mts
 */
import { chromium, type Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3101';
const OUT = resolve('docs/stage2d');
const GPU_ARGS = [
  '--no-sandbox',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
  '--use-angle=vulkan',
  '--disable-software-rasterizer',
];

const PROFILES = [
  { id: 'A-cad-light', file: 'performance-cad-light.json', query: '?perf=1&playback=paused&quality=demo&camera=off', runSec: 32, play: false },
  { id: 'B-cad-physics', file: 'performance-cad-physics.json', query: '?perf=1&playback=1&quality=demo&speed=1', runSec: 32, play: true },
  { id: 'C-full-runtime', file: 'performance-full-runtime.json', query: '?perf=1&quality=demo', runSec: 32, play: true },
  { id: 'D-cinematic-full', file: 'performance-cinematic-full.json', query: '?perf=1&stage0=1&post=1&quality=demo', runSec: 32, play: true },
  { id: 'E-mobile-low', file: 'performance-mobile-low.json', query: '?perf=1&quality=low&playback=1', runSec: 32, play: true, mobile: true },
] as const;

type Snap = {
  averageFps: number;
  minimumFps: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  renderer: string;
  hardwareAccelerated: boolean;
  dpr: number;
  heapMb: number;
};

async function waitScene(page: Page) {
  await page.waitForSelector('canvas', { timeout: 90_000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading 3D'), { timeout: 90_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    (window as unknown as { __PERF_RESET__?: () => void }).__PERF_RESET__?.();
  });
}

async function sample(page: Page, seconds: number): Promise<Snap> {
  await page.waitForTimeout(seconds * 1000);
  const snap = await page.evaluate(() => {
    const s = (window as unknown as { __PERF_SNAPSHOT__?: Snap }).__PERF_SNAPSHOT__;
    if (!s) throw new Error('no __PERF_SNAPSHOT__ — open with ?perf=1');
    return s;
  });
  return snap;
}

function median(nums: number[]) {
  const a = [...nums].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

async function runProfile(page: Page, profile: (typeof PROFILES)[number]) {
  const runs: Snap[] = [];
  for (let i = 0; i < 3; i++) {
    if (profile.mobile) {
      await page.setViewportSize({ width: 390, height: 844 });
    } else {
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await page.goto(`${BASE}/${profile.query}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await waitScene(page);
    if (profile.play) {
      const play = page.getByTestId('demo-play');
      if (await play.isVisible().catch(() => false)) await play.click();
    }
    const snap = await sample(page, profile.runSec);
    runs.push(snap);
    console.log(`  run ${i + 1}: fps=${snap.averageFps.toFixed(1)} p95=${snap.p95FrameTimeMs.toFixed(1)} draws=${snap.drawCalls} tris=${snap.triangles} hw=${snap.hardwareAccelerated} ${snap.renderer.slice(0, 60)}`);
  }
  const result = {
    profile: profile.id,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    gpuArgs: GPU_ARGS,
    runs,
    median: {
      avgFps: median(runs.map((r) => r.averageFps)),
      minFps: median(runs.map((r) => r.minimumFps)),
      p95Ms: median(runs.map((r) => r.p95FrameTimeMs)),
      p99Ms: median(runs.map((r) => r.p99FrameTimeMs)),
      drawCalls: median(runs.map((r) => r.drawCalls)),
      triangles: median(runs.map((r) => r.triangles)),
      heapMb: median(runs.map((r) => r.heapMb)),
    },
    renderer: runs[0]?.renderer,
    hardwareAccelerated: runs.every((r) => r.hardwareAccelerated),
    budget: {
      avgFpsMin: 45,
      avgFpsTarget: 55,
      p95Max: 28,
      p95Target: 20,
      drawCallsMax: 250,
      trisMax: 500_000,
      trisTarget: 350_000,
    },
    pass: (() => {
      const m = {
        avgFps: median(runs.map((r) => r.averageFps)),
        p95Ms: median(runs.map((r) => r.p95FrameTimeMs)),
        drawCalls: median(runs.map((r) => r.drawCalls)),
        triangles: median(runs.map((r) => r.triangles)),
      };
      const hw = runs.every((r) => r.hardwareAccelerated);
      if (!hw) return 'INSUFFICIENT_HARDWARE_PERFORMANCE_DATA';
      if (m.avgFps >= 45 && m.p95Ms <= 28 && m.drawCalls <= 250 && m.triangles <= 500_000) return 'PASS';
      return 'FAIL';
    })(),
  };
  writeFileSync(resolve(OUT, profile.file), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
  const page = await browser.newPage();
  // Validate GPU once
  const gpu = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      ok: true,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  });
  console.log('GPU probe', gpu);
  if (!gpu.ok || /SwiftShader|llvmpipe|softpipe/i.test(String((gpu as { renderer?: string }).renderer))) {
    console.error('Hardware GPU not available for this browser launch');
    writeFileSync(resolve(OUT, 'performance-comparison.json'), JSON.stringify({
      status: 'INSUFFICIENT_HARDWARE_PERFORMANCE_DATA',
      gpu,
    }, null, 2));
    await browser.close();
    process.exit(2);
  }

  const results = [];
  for (const p of PROFILES) {
    console.log('PROFILE', p.id);
    results.push(await runProfile(page, p));
  }
  writeFileSync(resolve(OUT, 'performance-comparison.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    gpu,
    results: results.map((r) => ({
      profile: r.profile,
      pass: r.pass,
      median: r.median,
      renderer: r.renderer,
      hardwareAccelerated: r.hardwareAccelerated,
    })),
  }, null, 2));
  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
