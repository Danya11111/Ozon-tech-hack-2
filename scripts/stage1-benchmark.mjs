/**
 * Stage 1 benchmark runner — real-model performance profiles.
 *
 * Profiles (Stage 1 §22):
 *   A  control     — Stage 0 Cinematic Light artifact from the SAME machine/GPU
 *                    (docs/stage0_premium_3d/performance-cinematic-light.json),
 *                    measured pre-integration. Not re-run: the working tree
 *                    cannot be rolled back without risking Stage 0 changes.
 *   B  real-products   — real models + procedural conveyor, cinematic light.
 *   C  real-conveyor   — SKIPPED: FCStd conversion blocked (no OCC toolchain).
 *                        No fictitious JSON is produced (Stage 1 §27).
 *   D  real-cinematic  — real models + Stage 0 post-processing spike.
 *   E  low-fallback    — 390x844 SVG fallback compatibility: no FPS sampling
 *                        (canvas is not mounted); asserts fallback renders and
 *                        ZERO /models/*.stl requests are made (Stage 1 §24).
 *
 * Usage:
 *   node scripts/stage1-benchmark.mjs [--url http://127.0.0.1:3101] [--runs 3]
 *                                     [--duration 32000] [--profile real-products]
 *                                     [--out docs/stage1_real_models]
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = argValue('url', 'http://127.0.0.1:3101');
const RUNS = Number(argValue('runs', '3'));
const DURATION_MS = Number(argValue('duration', '32000'));
const OUT_DIR = argValue('out', 'docs/stage1_real_models');
const ONLY = argValue('profile', null);
const EXEC = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

// Flags proven in Stage 0 to bind headless Chromium to the NVIDIA GTX 1080.
const GPU_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl-egl',
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--disable-software-rasterizer',
  '--disable-vulkan-surface',
];

const PROFILES = [
  {
    name: 'real-products',
    file: 'performance-real-products.json',
    shot: null,
    path: '/?stage0=1&perf=1&shadows=1&camera=1&post=0',
    viewport: { width: 1920, height: 1080 },
    mobile: false,
  },
  {
    name: 'real-cinematic',
    file: 'performance-real-cinematic.json',
    shot: null,
    path: '/?stage0=1&perf=1&shadows=1&camera=1&post=1',
    viewport: { width: 1920, height: 1080 },
    mobile: false,
  },
  {
    name: 'low-fallback',
    file: 'performance-low-fallback.json',
    shot: null,
    path: '/',
    viewport: { width: 390, height: 844 },
    mobile: true,
    dpr: 3,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    fallbackCheck: true,
  },
];

const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i;

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function collectRun(browser, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.dpr ?? 1,
    userAgent: profile.userAgent,
    isMobile: profile.mobile ?? false,
    hasTouch: profile.mobile ?? false,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  await page.addInitScript(() => {
    window.__CTX_LOST__ = 0;
    window.__MODEL_REQUESTS__ = [];
    window.addEventListener('webglcontextlost', () => window.__CTX_LOST__++, true);
  });
  const modelRequests = [];
  page.on('request', (req) => {
    if (/\/models\/.*\.(stl|glb|gltf)/i.test(req.url())) modelRequests.push(req.url());
  });

  const loadStart = Date.now();
  await page.goto(`${BASE}${profile.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  if (profile.fallbackCheck) {
    // Profile E: SVG fallback compatibility — no canvas expected.
    await page.waitForSelector('[data-testid="main-svg-fallback"]', { timeout: 30_000 });
    const sceneLoadMs = Date.now() - loadStart;
    await page.waitForTimeout(6000);
    const canvasCount = await page.locator('canvas').count();
    const ctxLost = await page.evaluate(() => window.__CTX_LOST__);
    const detailsLinkVisible = await page.locator('.fallback-details-link').isVisible().catch(() => false);
    await context.close();
    return {
      fallbackVisible: true,
      canvasCount,
      ctxLost,
      modelRequests,
      detailsLinkVisible,
      consoleErrors,
      sceneLoadMs,
    };
  }

  await page.waitForSelector('canvas', { timeout: 30_000 });
  const sceneLoadMs = Date.now() - loadStart;

  const play = page.locator('[data-testid="demo-play"]');
  if (await play.count()) {
    await play.first().click({ timeout: 5000 }).catch(() => undefined);
  }

  await page.waitForFunction(() => typeof window.__PERF_SNAPSHOT__ === 'object', null, { timeout: 15_000 });
  // Warmup: shader compilation + lazy chunks before sampling.
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.__PERF_RESET__?.());
  await page.waitForTimeout(DURATION_MS);

  const snapshot = await page.evaluate(() => window.__PERF_SNAPSHOT__);
  const ctxLost = await page.evaluate(() => window.__CTX_LOST__);
  const device = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl2 = canvas?.getContext('webgl2');
    const gl = gl2 ?? canvas?.getContext('webgl');
    let version = 'unknown';
    let vendor = 'unknown';
    if (gl) {
      version = gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1';
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    }
    return {
      webglVersion: version,
      vendor,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemory: navigator.deviceMemory ?? null,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      userAgent: navigator.userAgent,
    };
  });

  await context.close();
  return { snapshot, device, consoleErrors, sceneLoadMs, ctxLost, modelRequests };
}

async function memoryLoop(browser, profile) {
  const context = await browser.newContext({ viewport: profile.viewport });
  const page = await context.newPage();
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.goto(`${BASE}${profile.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('canvas', { timeout: 30_000 });
    const play = page.locator('[data-testid="demo-play"]');
    if (await play.count()) {
      await play.first().click({ timeout: 5000 }).catch(() => undefined);
    }
    await page.waitForTimeout(8000);
    const snap = await page.evaluate(() => window.__PERF_SNAPSHOT__).catch(() => null);
    if (snap) {
      samples.push({ heapMb: snap.heapMb, geometries: snap.geometries, textures: snap.textures });
    }
  }
  await context.close();
  return samples;
}

async function runProfile(browser, profile) {
  console.log(`\n=== Profile: ${profile.name} (${RUNS} runs x ${DURATION_MS}ms) ===`);

  if (profile.fallbackCheck) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await collectRun(browser, profile);
      runs.push(r);
      console.log(
        `  run ${i + 1}: fallback=${r.fallbackVisible} canvases=${r.canvasCount} ` +
          `modelRequests=${r.modelRequests.length} errors=${r.consoleErrors.length}`,
      );
    }
    const result = {
      profile: profile.name,
      url: `${BASE}${profile.path}`,
      kind: 'SVG_FALLBACK_COMPATIBILITY',
      policy: 'mobile default = SVG fallback; real-model assets must NOT load',
      runs: runs.map((r) => ({
        fallbackVisible: r.fallbackVisible,
        canvasCount: r.canvasCount,
        detailsLinkVisible: r.detailsLinkVisible,
        modelRequests: r.modelRequests,
        consoleErrors: r.consoleErrors,
        sceneLoadMs: r.sceneLoadMs,
        ctxLost: r.ctxLost,
      })),
      verdict: runs.every((r) => r.fallbackVisible && r.modelRequests.length === 0 && r.consoleErrors.length === 0)
        ? 'PASS'
        : 'FAIL',
      measuredAt: new Date().toISOString(),
    };
    writeFileSync(join(OUT_DIR, profile.file), JSON.stringify(result, null, 2));
    console.log(`  -> wrote ${profile.file} | verdict=${result.verdict}`);
    return result;
  }

  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await collectRun(browser, profile);
    runs.push(r);
    console.log(
      `  run ${i + 1}: avgFPS=${r.snapshot.averageFps} minFPS=${r.snapshot.minimumFps} ` +
        `p95=${r.snapshot.p95FrameTimeMs}ms p99=${r.snapshot.p99FrameTimeMs}ms drawCalls=${r.snapshot.drawCalls} ` +
        `tris=${r.snapshot.triangles} renderer=${r.snapshot.renderer}`,
    );
  }

  const avgFpsMedian = median(runs.map((r) => r.snapshot.averageFps));
  const minFpsMedian = median(runs.map((r) => r.snapshot.minimumFps));
  const p95Median = median(runs.map((r) => r.snapshot.p95FrameTimeMs));
  const renderer = runs[0].snapshot.renderer;
  const software = SOFTWARE_RE.test(renderer);

  const memory = await memoryLoop(browser, profile);
  const memGrowth = memory.length >= 2
    ? {
        heapMbDelta: Number((memory[memory.length - 1].heapMb - memory[0].heapMb).toFixed(2)),
        geometriesDelta: memory[memory.length - 1].geometries - memory[0].geometries,
        texturesDelta: memory[memory.length - 1].textures - memory[0].textures,
      }
    : null;

  const result = {
    profile: profile.name,
    url: `${BASE}${profile.path}`,
    runs: runs.map((r) => ({
      snapshot: r.snapshot,
      sceneLoadMs: r.sceneLoadMs,
      consoleErrors: r.consoleErrors,
      ctxLost: r.ctxLost,
      modelRequests: r.modelRequests,
    })),
    median: {
      averageFps: avgFpsMedian,
      minimumFps: minFpsMedian,
      p5Fps: p95Median > 0 ? Number((1000 / p95Median).toFixed(2)) : 0, // 5th-percentile FPS ≈ 1000/p95 frame time
      p95FrameTimeMs: p95Median,
      p99FrameTimeMs: median(runs.map((r) => r.snapshot.p99FrameTimeMs)),
      longFramesOver33: runs[0].snapshot.longFramesOver33,
      longFramesOver50: runs[0].snapshot.longFramesOver50,
      drawCalls: runs[0].snapshot.drawCalls,
      triangles: runs[0].snapshot.triangles,
      geometries: runs[0].snapshot.geometries,
      textures: runs[0].snapshot.textures,
      programs: runs[0].snapshot.programs,
      heapMb: median(runs.map((r) => r.snapshot.heapMb)),
      dpr: runs[0].snapshot.dpr,
      sceneLoadMs: median(runs.map((r) => r.sceneLoadMs)),
      contextLosses: runs.reduce((n, r) => n + r.ctxLost, 0),
    },
    device: runs[0].device,
    renderer,
    softwareRenderer: software,
    validity: software ? 'SOFTWARE_RENDERER_NOT_VALID_FOR_GPU_BASELINE' : 'HARDWARE_GPU_VALID',
    memoryLoop: { samples: memory, growth: memGrowth },
    consoleErrorCount: runs.reduce((n, r) => n + r.consoleErrors.length, 0),
    measuredAt: new Date().toISOString(),
    durationMsPerRun: DURATION_MS,
  };

  writeFileSync(join(OUT_DIR, profile.file), JSON.stringify(result, null, 2));
  console.log(`  -> wrote ${profile.file} | median avgFPS=${avgFpsMedian.toFixed(1)} validity=${result.validity}`);
  return result;
}

async function main() {
  mkdirSync(join(OUT_DIR, 'screenshots'), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC,
    args: GPU_ARGS,
    timeout: 45_000,
  });

  const profiles = ONLY ? PROFILES.filter((p) => p.name === ONLY) : PROFILES;
  if (profiles.length === 0) {
    throw new Error(`Unknown profile: ${ONLY}. Available: ${PROFILES.map((p) => p.name).join(', ')}`);
  }

  console.log('Profile A (control): docs/stage0_premium_3d/performance-cinematic-light.json (same GPU, pre-integration)');
  console.log('Profile C (real-conveyor): SKIPPED — FCStd conversion blocked, no OCC toolchain (Stage 1 §13.5)');

  const results = [];
  for (const profile of profiles) {
    results.push(await runProfile(browser, profile));
  }
  await browser.close();

  console.log('\n=== Summary ===');
  for (const r of results) {
    if (r.kind === 'SVG_FALLBACK_COMPATIBILITY') {
      console.log(`${r.profile.padEnd(16)} verdict=${r.verdict}`);
    } else {
      console.log(
        `${r.profile.padEnd(16)} avg=${r.median.averageFps.toFixed(1)} min=${r.median.minimumFps.toFixed(1)} ` +
          `p95=${r.median.p95FrameTimeMs}ms p99=${r.median.p99FrameTimeMs}ms calls=${r.median.drawCalls} ` +
          `tris=${r.median.triangles} ctxLost=${r.median.contextLosses} ${r.validity}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
