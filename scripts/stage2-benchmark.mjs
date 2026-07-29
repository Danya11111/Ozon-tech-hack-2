/**
 * Stage 2 benchmark — CAD conveyor + physics + premium visuals.
 *
 * Profiles (Stage 2 §15/§20):
 *   cad-light    — CAD conveyor, medium quality (no shadows/env), physics on.
 *   cad-physics  — high quality + physics step timing (window.__PHYSICS_PERF__).
 *   cad-full     — full premium look (PCF shadows, studio env, cinematic camera).
 *   mobile-fallback — 390x844 SVG fallback, zero /models/* requests expected.
 *
 * Usage: node scripts/stage2-benchmark.mjs [--url ...] [--runs 3] [--duration 32000]
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
const OUT_DIR = argValue('out', 'docs/stage2_real_sorter');
const ONLY = argValue('profile', null);
const EXEC = '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const GPU_ARGS = [
  '--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu',
  '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--disable-vulkan-surface',
];

const PROFILES = [
  { name: 'cad-light', file: 'performance-cad-light.json', path: '/?perf=1&quality=medium', viewport: { width: 1920, height: 1080 } },
  { name: 'cad-physics', file: 'performance-cad-physics.json', path: '/?perf=1&quality=high', viewport: { width: 1920, height: 1080 }, physics: true },
  { name: 'cad-full', file: 'performance-cad-full.json', path: '/?perf=1&quality=demo', viewport: { width: 1920, height: 1080 }, physics: true, memoryLoop: true },
  {
    name: 'mobile-fallback', file: 'performance-mobile-fallback.json', path: '/', viewport: { width: 390, height: 844 },
    mobile: true, dpr: 3, fallbackCheck: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  },
];

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
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  await page.addInitScript(() => {
    window.__CTX_LOST__ = 0;
    window.addEventListener('webglcontextlost', () => window.__CTX_LOST__++, true);
  });
  const modelRequests = [];
  page.on('request', (req) => { if (/\/models\/.*\.(stl|glb|gltf)/i.test(req.url())) modelRequests.push(req.url()); });

  const loadStart = Date.now();
  await page.goto(`${BASE}${profile.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  if (profile.fallbackCheck) {
    await page.waitForSelector('[data-testid="main-svg-fallback"]', { timeout: 30_000 });
    const sceneLoadMs = Date.now() - loadStart;
    await page.waitForTimeout(6000);
    const canvasCount = await page.locator('canvas').count();
    const ctxLost = await page.evaluate(() => window.__CTX_LOST__);
    await context.close();
    return { fallbackVisible: true, canvasCount, ctxLost, modelRequests, consoleErrors, sceneLoadMs };
  }

  await page.waitForSelector('canvas', { timeout: 30_000 });
  const sceneLoadMs = Date.now() - loadStart;
  const play = page.locator('[data-testid="demo-play"]');
  if (await play.count()) await play.first().click({ timeout: 5000 }).catch(() => undefined);

  await page.waitForFunction(() => typeof window.__PERF_SNAPSHOT__ === 'object', null, { timeout: 15_000 });
  await page.waitForTimeout(5000); // shader warmup
  await page.evaluate(() => window.__PERF_RESET__?.());
  await page.waitForTimeout(DURATION_MS);

  const snapshot = await page.evaluate(() => window.__PERF_SNAPSHOT__);
  const physicsPerf = profile.physics ? await page.evaluate(() => window.__PHYSICS_PERF__ ?? null) : null;
  const drops = await page.evaluate(() => window.__DROP_RESULTS ?? []);
  const ctxLost = await page.evaluate(() => window.__CTX_LOST__);
  const device = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl2 = canvas?.getContext('webgl2');
    const gl = gl2 ?? canvas?.getContext('webgl');
    let vendor = 'unknown';
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    }
    return {
      vendor,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemory: navigator.deviceMemory ?? null,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  await context.close();
  return { snapshot, physicsPerf, drops, device, consoleErrors, sceneLoadMs, ctxLost, modelRequests };
}

async function memoryLoop(browser, profile) {
  const context = await browser.newContext({ viewport: profile.viewport });
  const page = await context.newPage();
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.goto(`${BASE}${profile.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('canvas', { timeout: 30_000 });
    const play = page.locator('[data-testid="demo-play"]');
    if (await play.count()) await play.first().click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(8000);
    const heap = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
    const bodies = await page.evaluate(() => (window.__DROP_RESULTS ?? []).length);
    samples.push({ cycle: i + 1, heapBytes: heap, dropResults: bodies });
    await page.evaluate(() => window.__PERF_RESET__?.());
  }
  await context.close();
  return samples;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: EXEC, args: GPU_ARGS });

for (const profile of PROFILES) {
  if (ONLY && profile.name !== ONLY) continue;
  console.log(`\n=== ${profile.name} ===`);
  const runs = [];
  for (let r = 0; r < (profile.fallbackCheck ? 1 : RUNS); r++) {
    runs.push(await collectRun(browser, profile));
    console.log(`  run ${r + 1} done`);
  }
  const fpsRuns = runs.map((x) => x.snapshot?.averageFps).filter((v) => typeof v === 'number');
  const p95Runs = runs.map((x) => x.snapshot?.p95FrameTimeMs).filter((v) => typeof v === 'number');
  const result = {
    profile: profile.name,
    path: profile.path,
    viewport: profile.viewport,
    runs: runs.length,
    fpsAvg: fpsRuns.length ? fpsRuns.reduce((s, v) => s + v, 0) / fpsRuns.length : null,
    fpsMin: Math.min(...runs.map((x) => x.snapshot?.minimumFps ?? Infinity)),
    frameTimeP95Ms: p95Runs.length ? median(p95Runs) : null,
    drawCalls: runs[0]?.snapshot?.drawCalls ?? null,
    triangles: runs[0]?.snapshot?.triangles ?? null,
    heapMb: runs.at(-1)?.snapshot?.heapMb ?? null,
    renderer: runs[0]?.snapshot?.renderer ?? null,
    physics: runs.find((x) => x.physicsPerf)?.physicsPerf ?? null,
    dropsVerified: (runs.at(-1)?.drops ?? []).map((d) => ({ caseId: d.caseId, zone: d.expectedZone, inside: d.insideExpectedReceiver })),
    device: runs[0]?.device ?? null,
    consoleErrors: [...new Set(runs.flatMap((x) => x.consoleErrors))],
    sceneLoadMs: median(runs.map((x) => x.sceneLoadMs)),
    ctxLost: Math.max(...runs.map((x) => x.ctxLost ?? 0)),
    modelRequests: [...new Set(runs.flatMap((x) => x.modelRequests))],
    fallback: profile.fallbackCheck ? runs[0] : undefined,
  };
  if (profile.memoryLoop) {
    console.log('  memory loop (10 cycles)...');
    result.memoryLoop = await memoryLoop(browser, profile);
  }
  writeFileSync(join(OUT_DIR, profile.file), JSON.stringify(result, null, 1));
  console.log(`  -> ${profile.file}: fpsAvg=${result.fpsAvg?.toFixed(1)} p95=${result.frameTimeP95Ms?.toFixed(2)}ms physicsP95=${result.physics?.p95Ms?.toFixed(3)}ms`);
}

await browser.close();
console.log('\nbenchmark complete');
