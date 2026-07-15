#!/usr/bin/env node
/**
 * Collect objective performance / asset metrics for the demo.
 * Writes docs/PERFORMANCE_AFTER_MAXIMUM_DEMO.md (partial) and agent/reports/perf-metrics.json
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

function gzipSize(file) {
  const r = spawnSync('gzip', ['-c', file], { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 });
  return r.stdout?.length ?? 0;
}

function collectBundleMetrics() {
  if (!existsSync(ASSETS)) throw new Error('dist/assets missing — run npm run build first');
  const files = readdirSync(ASSETS);
  const rows = files.map((name) => {
    const p = join(ASSETS, name);
    const st = statSync(p);
    return {
      name,
      bytes: st.size,
      gzip: name.match(/\.(js|css)$/) ? gzipSize(p) : null,
    };
  });
  const js = rows.filter((r) => r.name.endsWith('.js'));
  const css = rows.filter((r) => r.name.endsWith('.css'));
  const totalJs = js.reduce((a, b) => a + b.bytes, 0);
  const totalJsGzip = js.reduce((a, b) => a + (b.gzip ?? 0), 0);
  const main = js.find((r) => r.name.startsWith('index-')) ?? js[0];
  const r3f = js.find((r) => r.name.includes('react-three-fiber')) ?? null;
  return { rows, totalJs, totalJsGzip, main, r3f, css };
}

function runPlaywrightPerf() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3101';
  const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(process.env.BASE, { waitUntil: 'networkidle', timeout: 60000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(2000);
  const heap1 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
  const play = page.getByTestId('demo-play').or(page.getByRole('button', { name: /play demo/i }));
  await play.click({ timeout: 10000 }).catch(()=>{});
  // sample rAF fps for 3s
  const fpsSample = await page.evaluate(async () => {
    return await new Promise(resolve => {
      let frames = 0;
      let last = performance.now();
      const times = [];
      function tick(now) {
        frames++;
        times.push(now - last);
        last = now;
        if (frames < 180) requestAnimationFrame(tick);
        else {
          const avg = 1000 / (times.reduce((a,b)=>a+b,0) / times.length);
          const sorted = [...times].sort((a,b)=>a-b);
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          resolve({ avgFps: avg, p95FrameMs: p95, minFps: 1000 / Math.max(...times) });
        }
      }
      requestAnimationFrame(tick);
    });
  });
  // jump to end-ish via seek if available
  for (let i = 0; i < 3; i++) {
    await play.click({ timeout: 3000 }).catch(()=>{});
    await page.waitForTimeout(500);
  }
  const heap2 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
  const canvas = await page.locator('canvas').count();
  await browser.close();
  console.log(JSON.stringify({ loadMs, heap1, heap2, fpsSample, canvas, errors }));
})().catch(e => { console.error(e); process.exit(1); });
`;
  const tmp = join(ROOT, 'scripts', '.perf-tmp.cjs');
  writeFileSync(tmp, script.replace('process.env.BASE', JSON.stringify(base)));
  const r = spawnSync('node', [tmp], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, BASE: base },
  });
  try { /* keep tmp for debug */ } catch {}
  if (r.status !== 0) {
    return { error: r.stderr || r.stdout || 'playwright perf failed', raw: r.stdout };
  }
  const line = r.stdout.trim().split('\n').filter(Boolean).pop();
  try {
    return JSON.parse(line);
  } catch {
    return { error: 'parse', raw: r.stdout };
  }
}

mkdirSync(join(ROOT, 'agent', 'reports'), { recursive: true });
const bundle = collectBundleMetrics();
let runtime = { skipped: true };
try {
  runtime = runPlaywrightPerf();
} catch (e) {
  runtime = { error: String(e) };
}

const report = {
  measuredAt: new Date().toISOString(),
  commit: spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim(),
  bundle: {
    totalJsBytes: bundle.totalJs,
    totalJsGzip: bundle.totalJsGzip,
    main: bundle.main,
    r3f: bundle.r3f,
  },
  runtime,
};

writeFileSync(join(ROOT, 'agent', 'reports', 'perf-metrics.json'), JSON.stringify(report, null, 2));

const fps = runtime?.fpsSample;
const md = `# PERFORMANCE_AFTER_MAXIMUM_DEMO

Measured: ${report.measuredAt}  
Commit: \`${report.commit}\`

## Bundle (measured)

| Метрика | Значение |
| ------- | -------: |
| Total JS | ${(bundle.totalJs / 1024).toFixed(1)} KB |
| Total JS gzip | ${(bundle.totalJsGzip / 1024).toFixed(1)} KB |
| Main chunk | ${bundle.main?.name ?? '—'} (${((bundle.main?.gzip ?? 0) / 1024).toFixed(1)} KB gzip) |
| R3F chunk gzip | ${bundle.r3f ? ((bundle.r3f.gzip ?? 0) / 1024).toFixed(1) + ' KB' : '—'} |

## Runtime (Playwright Chromium headless)

| Метрика | До | После | Цель | Статус |
| ------- | -: | ----: | ---: | ------ |
| Average FPS | n/a (не измерялось) | ${fps ? fps.avgFps.toFixed(1) : 'n/a'} | ≥30 | ${fps && fps.avgFps >= 30 ? 'OK' : 'CHECK'} |
| Minimum FPS | n/a | ${fps ? fps.minFps.toFixed(1) : 'n/a'} | ≥20 | ${fps && fps.minFps >= 20 ? 'OK' : 'CHECK'} |
| p95 frame time | n/a | ${fps ? fps.p95FrameMs.toFixed(1) + ' ms' : 'n/a'} | ≤33 ms | ${fps && fps.p95FrameMs <= 33 ? 'OK' : 'CHECK'} |
| Load time | n/a | ${runtime.loadMs ?? 'n/a'} ms | ≤5000 | ${(runtime.loadMs ?? 99999) <= 5000 ? 'OK' : 'CHECK'} |
| JS heap start | n/a | ${runtime.heap1 ?? 'n/a'} | — | measured |
| JS heap after interaction | n/a | ${runtime.heap2 ?? 'n/a'} | no runaway | measured |
| Canvas present | — | ${runtime.canvas ?? 0} | ≥1 | ${(runtime.canvas ?? 0) >= 1 ? 'OK' : 'FAIL'} |
| JS gzip (main+vendor) | ~335 KB main previously | ${(bundle.totalJsGzip / 1024).toFixed(1)} KB | — | measured |

## Notes

- Draw calls / triangles require WebGL inspector in headed mode; not available in this headless pass.
- \`performance.memory\` may be null outside Chromium with \`--enable-precise-memory-info\`.
- Demo quality mode keeps \`shadows=false\` and \`effectsEnabled=false\` for stable FPS (see \`qualityMode.ts\`).
- Raw JSON: \`agent/reports/perf-metrics.json\`
- Runtime error (if any): ${runtime.error ? String(runtime.error).slice(0, 200) : 'none'}
`;

writeFileSync(join(ROOT, 'docs', 'PERFORMANCE_AFTER_MAXIMUM_DEMO.md'), md);
console.log(JSON.stringify({ ok: true, fps, loadMs: runtime.loadMs, totalJsGzip: bundle.totalJsGzip }, null, 2));
