/**
 * Stage 2E — physics p95 profiles on hardware GPU.
 * Usage: PERF_BASE_URL=http://127.0.0.1:3101 npx tsx scripts/stage2e-physics-profiles.mts
 */
import { chromium, type Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3101';
const OUT = resolve('docs/stage2e');
const GPU_ARGS = [
  '--no-sandbox',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
  '--use-angle=vulkan',
  '--disable-software-rasterizer',
];

type Phys = {
  count: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  over4Ms: number;
  over8Ms: number;
  activeBodies: number;
  sleepingBodies: number;
  colliders: number;
  lastSubsteps: number;
};

const PROFILES = [
  {
    id: 'physics-belt-only',
    file: 'physics-belt-only.json',
    // World must step: keep playback running with kinematic belt phase (no pause).
    query: '?perf=1&physicsPerf=1&quality=demo&speed=1&camera=off',
    runSec: 32,
    play: true,
    seek: 0,
  },
  {
    id: 'physics-mechanism-contact',
    file: 'physics-mechanism-contact.json',
    query: '?perf=1&physicsPerf=1&quality=demo&speed=1',
    runSec: 35,
    play: true,
    seek: 3, // pen → C (mechanism)
  },
  {
    id: 'physics-drop-collision',
    file: 'physics-drop-collision.json',
    query: '?perf=1&physicsPerf=1&quality=demo&speed=1',
    runSec: 40,
    play: true,
    seek: 2, // oversized → C
  },
  {
    id: 'physics-worst-case',
    file: 'physics-worst-case.json',
    query: '?perf=1&physicsPerf=1&quality=demo&speed=1.5',
    runSec: 40,
    play: true,
    seek: 0, // continuous playlist
  },
] as const;

function median(nums: number[]) {
  const a = [...nums].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] ?? 0;
}

async function waitScene(page: Page) {
  await page.waitForSelector('canvas', { timeout: 90_000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading 3D'), {
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    (window as unknown as { __PHYSICS_PERF_RESET__?: () => void }).__PHYSICS_PERF_RESET__?.();
    (window as unknown as { __PERF_RESET__?: () => void }).__PERF_RESET__?.();
  });
}

async function runProfile(page: Page, profile: (typeof PROFILES)[number]) {
  const runs: Phys[] = [];
  for (let i = 0; i < 3; i++) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/${profile.query}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await waitScene(page);
    if (profile.seek != null) {
      const btn = page.getByTestId(`demo-case-${profile.seek}`);
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    if (profile.play) {
      const play = page.getByTestId('demo-play');
      if (await play.isVisible().catch(() => false)) await play.click();
    }
    await page.waitForTimeout(profile.runSec * 1000);
    const snap = await page.evaluate(() => {
      return (window as unknown as { __PHYSICS_PERF__?: Phys }).__PHYSICS_PERF__;
    });
    if (!snap || !snap.count) {
      throw new Error(`No __PHYSICS_PERF__ for ${profile.id} run ${i + 1}`);
    }
    runs.push(snap);
    console.log(
      `  ${profile.id} run ${i + 1}: n=${snap.count} avg=${snap.avgMs.toFixed(3)} p95=${snap.p95Ms.toFixed(3)} max=${snap.maxMs.toFixed(3)} over4=${snap.over4Ms} bodies=${snap.activeBodies}/${snap.sleepingBodies}`,
    );
  }
  const med = {
    avgMs: median(runs.map((r) => r.avgMs)),
    medianMs: median(runs.map((r) => r.medianMs)),
    p95Ms: median(runs.map((r) => r.p95Ms)),
    p99Ms: median(runs.map((r) => r.p99Ms)),
    maxMs: median(runs.map((r) => r.maxMs)),
    over4Ms: median(runs.map((r) => r.over4Ms)),
    over8Ms: median(runs.map((r) => r.over8Ms)),
    activeBodies: median(runs.map((r) => r.activeBodies)),
    sleepingBodies: median(runs.map((r) => r.sleepingBodies)),
    colliders: median(runs.map((r) => r.colliders)),
    sampleCount: median(runs.map((r) => r.count)),
  };
  const result = {
    profile: profile.id,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    gpuArgs: GPU_ARGS,
    budgetP95Ms: 4,
    runs,
    median: med,
    pass: med.p95Ms <= 4 ? 'PASS' : 'FAIL',
  };
  writeFileSync(resolve(OUT, profile.file), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
  const page = await browser.newPage();
  const gpu = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      ok: true,
      renderer: dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  });
  console.log('GPU', gpu);
  if (!gpu.ok || /SwiftShader|llvmpipe/i.test(String((gpu as { renderer?: string }).renderer))) {
    console.error('Hardware GPU required');
    process.exit(2);
  }
  const results = [];
  for (const p of PROFILES) {
    console.log('PROFILE', p.id);
    results.push(await runProfile(page, p));
  }
  writeFileSync(
    resolve(OUT, 'physics-profile-summary.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), gpu, results }, null, 2),
  );
  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
