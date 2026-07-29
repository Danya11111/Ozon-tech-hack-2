/**
 * Stage 0 benchmark runner.
 * Measures the four required performance profiles against the preview server
 * using headless Chromium forced onto the discrete NVIDIA GPU (ANGLE gl-egl).
 *
 * Usage:
 *   node scripts/stage0-benchmark.mjs [--url http://127.0.0.1:3100] [--runs 3]
 *                                     [--duration 32000] [--profile baseline]
 *                                     [--out docs/stage0_premium_3d]
 *
 * SOFTWARE_RENDERER results are marked and never treated as GPU baseline.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = argValue('url', 'http://127.0.0.1:3100');
const RUNS = Number(argValue('runs', '3'));
const DURATION_MS = Number(argValue('duration', '32000'));
const OUT_DIR = argValue('out', 'docs/stage0_premium_3d');
const ONLY = argValue('profile', null);
const EXEC = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

// Flags proven in scripts/stage0-gpu-probe.mjs to bind headless Chromium to the
// NVIDIA GTX 1080 instead of SwiftShader.
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
    name: 'baseline',
    file: 'performance-baseline.json',
    shot: '01-baseline-desktop.png',
    path: '/?perf=1',
    viewport: { width: 1920, height: 1080 },
    mobile: false,
  },
  {
    name: 'cinematic-light',
    file: 'performance-cinematic-light.json',
    shot: '02-cinematic-light-desktop.png',
    path: '/?stage0=1&perf=1&shadows=1&camera=1&post=0',
    viewport: { width: 1920, height: 1080 },
    mobile: false,
  },
  {
    name: 'cinematic-full',
    file: 'performance-cinematic-full.json',
    shot: '03-cinematic-full-desktop.png',
    path: '/?stage0=1&perf=1&shadows=1&camera=1&post=1',
    viewport: { width: 1920, height: 1080 },
    mobile: false,
  },
  {
    name: 'mobile-low',
    file: 'performance-mobile-low.json',
    shot: null, // SVG fallback screenshot is produced by the e2e test
    path: '/?stage0=1&perf=1&quality=low&shadows=0&camera=0&post=0',
    viewport: { width: 390, height: 844 },
    mobile: true,
    dpr: 3,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
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

  const loadStart = Date.now();
  await page.goto(`${BASE}${profile.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('canvas', { timeout: 30_000 });
  const sceneLoadMs = Date.now() - loadStart;

  // Start playback if the play button is visible.
  const play = page.locator('[data-testid="demo-play"]');
  if (await play.count()) {
    await play.first().click({ timeout: 5000 }).catch(() => undefined);
  }

  await page.waitForFunction(() => typeof window.__PERF_SNAPSHOT__ === 'object', null, { timeout: 15_000 });
  // Warmup: let shaders compile and lazy chunks load before sampling, so
  // minimum FPS is not poisoned by one-time init stalls.
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.__PERF_RESET__?.());
  await page.waitForTimeout(DURATION_MS);

  const snapshot = await page.evaluate(() => window.__PERF_SNAPSHOT__);
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
  const adaptLog = await page.evaluate(() => window.__STAGE0_ADAPT__ ?? []);

  if (profile.shot) {
    await page.screenshot({ path: join(OUT_DIR, 'screenshots', profile.shot) });
  }

  await context.close();
  return { snapshot, device, consoleErrors, sceneLoadMs, adaptLog };
}

async function memoryLoop(browser, profile) {
  // 10 reload repetitions: compare heap / geometries / textures first vs last.
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
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await collectRun(browser, profile);
    runs.push(r);
    console.log(
      `  run ${i + 1}: avgFPS=${r.snapshot.averageFps} minFPS=${r.snapshot.minimumFps} ` +
        `p95=${r.snapshot.p95FrameTimeMs}ms drawCalls=${r.snapshot.drawCalls} tris=${r.snapshot.triangles} ` +
        `renderer=${r.snapshot.renderer}`,
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
      adaptLog: r.adaptLog,
    })),
    median: {
      averageFps: avgFpsMedian,
      minimumFps: minFpsMedian,
      p95FrameTimeMs: p95Median,
      drawCalls: runs[0].snapshot.drawCalls,
      triangles: runs[0].snapshot.triangles,
      geometries: runs[0].snapshot.geometries,
      textures: runs[0].snapshot.textures,
      heapMb: median(runs.map((r) => r.snapshot.heapMb)),
      dpr: runs[0].snapshot.dpr,
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

  const results = [];
  for (const profile of profiles) {
    results.push(await runProfile(browser, profile));
  }
  await browser.close();

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(
      `${r.profile.padEnd(16)} avg=${r.median.averageFps.toFixed(1)} min=${r.median.minimumFps.toFixed(1)} ` +
        `p95=${r.median.p95FrameTimeMs}ms calls=${r.median.drawCalls} tris=${r.median.triangles} ${r.validity}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
