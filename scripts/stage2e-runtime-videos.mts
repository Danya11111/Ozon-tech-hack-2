/**
 * Stage 2E — record runtime route videos via Playwright (hardware GPU).
 * Usage: PERF_BASE_URL=http://127.0.0.1:3101 npx tsx scripts/stage2e-runtime-videos.mts
 */
import { chromium } from 'playwright';
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const BASE = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3101';
const OUT = resolve('docs/stage2e/videos');
const SHOTS = resolve('docs/stage2e/screenshots');
const GPU_ARGS = [
  '--no-sandbox',
  '--ignore-gpu-blocklist',
  '--enable-gpu',
  '--use-angle=vulkan',
  '--disable-software-rasterizer',
];

/** Playlist indices after pouf insert. */
const ROUTES = [
  { file: 'box-route-b', caseIndex: 0, waitMs: 14000, settledShot: '03-route-b-settled.png' },
  { file: 'pen-route-c', caseIndex: 3, waitMs: 16000 },
  { file: 'pouf-route-c', caseIndex: 4, waitMs: 16000 },
  { file: 'oversized-route-c', caseIndex: 2, waitMs: 18000, settledShot: '04-route-c-settled.png' },
  { file: 'bottle-route-d', caseIndex: 6, waitMs: 16000 },
  { file: 'plate-route-d', caseIndex: 5, waitMs: 16000, settledShot: '05-route-d-settled.png' },
  { file: 'cylinder-route-d', caseIndex: 8, waitMs: 16000 },
] as const;

const SLOW = [
  { file: 'box-route-b-slow', caseIndex: 0, waitMs: 45000, speed: '0.25' },
  { file: 'oversized-route-c-slow', caseIndex: 2, waitMs: 50000, speed: '0.25' },
  { file: 'plate-route-d-slow', caseIndex: 5, waitMs: 45000, speed: '0.25' },
  { file: 'cylinder-route-d-slow', caseIndex: 8, waitMs: 45000, speed: '0.25' },
] as const;

async function recordOne(
  name: string,
  caseIndex: number,
  waitMs: number,
  speed: string,
  settledShot?: string,
) {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: GPU_ARGS,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const q =
    speed === '1'
      ? `?debug=1&quality=demo&speed=1`
      : `?debug=1&quality=demo&speed=${speed}`;
  await page.goto(`${BASE}/${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForSelector('canvas', { timeout: 90_000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading 3D'), {
    timeout: 90_000,
  });
  await page.waitForTimeout(1000);
  // Case dots only render with ?debug=1
  await page.getByTestId(`demo-case-${caseIndex}`).click({ force: true });
  const play = page.getByTestId('demo-play');
  const pause = page.getByTestId('demo-pause');
  if (await play.isVisible().catch(() => false)) await play.click({ force: true });
  else if (!(await pause.isVisible().catch(() => false))) {
    /* already running */
  }
  // Burst mid-run for contact evidence
  await page.waitForTimeout(Math.floor(waitMs * 0.45));
  if (name.includes('pen') || name.includes('oversized') || name.includes('plate')) {
    await page.screenshot({ path: join(SHOTS, '02-mechanism-contact.png') });
  }
  await page.waitForTimeout(Math.floor(waitMs * 0.55));
  if (settledShot) {
    await page.screenshot({ path: join(SHOTS, settledShot) });
  }
  await context.close();
  await browser.close();
  // Playwright names video by page guid — rename newest webm
  const { readdirSync, statSync, renameSync } = await import('fs');
  const files = readdirSync(OUT)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => ({ f, m: statSync(join(OUT, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (files.length === 0) throw new Error(`No webm for ${name}`);
  const dest = join(OUT, `${name}.webm`);
  if (existsSync(dest)) {
    try {
      renameSync(dest, join(OUT, `${name}-prev.webm`));
    } catch {
      /* ignore */
    }
  }
  renameSync(join(OUT, files[0].f), dest);
  console.log('wrote', dest, statSync(dest).size);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const r of ROUTES) {
    console.log('REC', r.file);
    await recordOne(r.file, r.caseIndex, r.waitMs, '1', 'settledShot' in r ? r.settledShot : undefined);
  }
  for (const r of SLOW) {
    console.log('REC slow', r.file);
    await recordOne(r.file, r.caseIndex, r.waitMs, r.speed);
  }
  writeFileSync(
    join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base: BASE,
        routes: ROUTES.map((r) => r.file),
        slow: SLOW.map((r) => r.file),
      },
      null,
      2,
    ),
  );
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
