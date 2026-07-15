#!/usr/bin/env node
/**
 * Replay resource stability probe — geometries/textures/programs/heap across N replays.
 *
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run perf:replay-stability
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CYCLES = [0, 1, 3, 5, 10]; // cumulative replay counts to sample after

function targetUrl() {
  const raw = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
  const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
  u.searchParams.set('perf', '1');
  u.searchParams.set('quality', 'demo');
  return u.toString();
}

async function snap(page) {
  return page.evaluate(() => {
    const s = window.__PERF_SNAPSHOT__;
    const canvasCount = document.querySelectorAll('canvas').length;
    return {
      at: new Date().toISOString(),
      geometries: s?.geometries ?? null,
      textures: s?.textures ?? null,
      programs: s?.programs ?? null,
      heapMb: s?.heapMb ?? null,
      drawCalls: s?.drawCalls ?? null,
      triangles: s?.triangles ?? null,
      renderer: s?.renderer ?? null,
      canvasCount,
    };
  });
}

async function dismissFinished(page) {
  const finished = page.getByTestId('demo-finished');
  if (await finished.isVisible().catch(() => false)) {
    await finished.getByRole('button', { name: /Replay/i }).click();
    await page.waitForTimeout(500);
  }
}

async function doReplay(page) {
  await dismissFinished(page);
  await page.getByTestId('demo-case-0').click().catch(() => undefined);
  await page.waitForTimeout(200);
  const pause = page.getByTestId('demo-pause');
  if (!(await pause.isVisible().catch(() => false))) {
    await page.getByTestId('demo-play').click().catch(() => undefined);
  }
  await page.waitForTimeout(1200);
}

function classify(rows) {
  const geos = rows.map((r) => r.geometries).filter((n) => typeof n === 'number');
  if (geos.length < 3) return 'INCONCLUSIVE';
  const first = geos[0];
  const last = geos[geos.length - 1];
  const mid = geos[Math.floor(geos.length / 2)];
  // plateau: late samples within +2 of mid
  const late = geos.slice(-2);
  const plateau = late.every((g) => Math.abs(g - mid) <= 2);
  const monotonic = geos.every((g, i) => i === 0 || g >= geos[i - 1]);
  const growth = last - first;
  if (plateau && growth <= 20) return 'LAZY_ALLOCATION_PLATEAU';
  if (monotonic && growth > 20 && !plateau) return 'POSSIBLE_LEAK';
  if (growth > 50) return 'CONFIRMED_LEAK';
  if (growth <= 5) return 'STABLE';
  return plateau ? 'LAZY_ALLOCATION_PLATEAU' : 'POSSIBLE_LEAK';
}

async function main() {
  const headed = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  const browser = await chromium.launch({
    headless: !headed,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const samples = [];

  try {
    await page.goto(targetUrl(), { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForTimeout(3000);
    samples.push({ cycle: 0, label: 'initial', ...(await snap(page)) });

    let done = 0;
    for (const target of CYCLES.slice(1)) {
      while (done < target) {
        await doReplay(page);
        done += 1;
      }
      samples.push({ cycle: target, label: `after_${target}_replays`, ...(await snap(page)) });
    }

    // GC pause
    await page.evaluate(() => {
      // @ts-expect-error
      if (typeof gc === 'function') gc();
    }).catch(() => undefined);
    await page.waitForTimeout(3000);
    samples.push({ cycle: 10, label: 'after_gc_pause', ...(await snap(page)) });
  } finally {
    await browser.close();
  }

  const verdict = classify(samples);
  const report = {
    measuredAt: new Date().toISOString(),
    url: targetUrl(),
    headed,
    verdict,
    samples,
  };

  mkdirSync(join(ROOT, 'agent', 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'agent', 'reports', 'replay-stability.json'), JSON.stringify(report, null, 2));

  const md = `# REPLAY_RESOURCE_STABILITY

Measured: ${report.measuredAt}
Verdict: **${verdict}**

| Cycle | Heap MB | Geometries | Textures | Programs | Canvas |
| ----: | ------: | ---------: | -------: | -------: | -----: |
${samples
  .map(
    (s) =>
      `| ${s.cycle} (${s.label}) | ${s.heapMb ?? '—'} | ${s.geometries ?? '—'} | ${s.textures ?? '—'} | ${s.programs ?? '—'} | ${s.canvasCount ?? '—'} |`,
  )
  .join('\n')}

## Interpretation

- **STABLE** — no meaningful growth.
- **LAZY_ALLOCATION_PLATEAU** — early growth then flat (expected for first-seen assets).
- **POSSIBLE_LEAK / CONFIRMED_LEAK** — investigate dispose paths.

Raw: \`agent/reports/replay-stability.json\`
`;
  writeFileSync(join(ROOT, 'docs', 'REPLAY_RESOURCE_STABILITY.md'), md);
  console.log(JSON.stringify({ ok: true, verdict, samples: samples.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
