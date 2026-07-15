#!/usr/bin/env node
/**
 * Portable headed browser benchmark for the presentation laptop.
 * Uses the system Chrome/Chromium channel when available — no forced GPU flags.
 *
 *   npm run perf:browser
 *   npm run perf:browser:export
 *
 * Env: PLAYWRIGHT_BASE_URL (default http://127.0.0.1:3100)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MODES = ['low', 'medium', 'high', 'demo'];
const exportOnly = process.argv.includes('--export') || process.env.PERF_EXPORT === '1';

function baseUrl() {
  const raw = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
  return new URL(raw.includes('://') ? raw : `http://${raw}`);
}

function urlFor(mode) {
  const u = baseUrl();
  u.searchParams.set('perf', '1');
  u.searchParams.set('quality', mode);
  return u.toString();
}

function isSoft(renderer = '') {
  return /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i.test(
    renderer,
  );
}

async function sample(page) {
  return (
    (await page.evaluate(() => {
      const s = window.__PERF_SNAPSHOT__;
      return s ? { ...s } : null;
    })) || {
      mode: 'demo',
      renderer: 'unknown',
      averageFps: 0,
      minimumFps: 0,
      p95FrameTimeMs: 0,
      p99FrameTimeMs: 0,
      longFramesOver33: 0,
      longFramesOver50: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      heapMb: 0,
      dpr: 1,
      shadows: false,
      antialias: false,
      hardwareAccelerated: false,
    }
  );
}

async function measureMode(browser, mode, notes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(urlFor(mode), { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__PERF_RESET__?.());
    await page.waitForTimeout(2500);
    const idle = await sample(page);

    await page.evaluate(() => window.__PERF_RESET__?.());
    await page.getByTestId('demo-play').click({ timeout: 8_000 }).catch(() => notes.push(`${mode}: play skipped`));
    await page.waitForTimeout(5000);
    const play = await sample(page);

    // Full-ish playlist: jump through cases quickly
    for (const idx of [0, 2, 4, 8, 9]) {
      await page.getByTestId(`demo-case-${idx}`).click().catch(() => undefined);
      await page.waitForTimeout(900);
    }
    const afterPlaylist = await sample(page);

    // Three replays (Replay Demo overlay or seek case 0 + play)
    for (let i = 0; i < 3; i++) {
      const finished = page.getByTestId('demo-finished');
      if (await finished.isVisible().catch(() => false)) {
        await finished.getByRole('button', { name: /Replay/i }).click().catch(() => undefined);
      } else {
        await page.getByTestId('demo-case-0').click().catch(() => undefined);
        await page.getByTestId('demo-play').click().catch(() => undefined);
      }
      await page.waitForTimeout(1500);
    }
    const afterReplay = await sample(page);

    const meta = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      webgl: (() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return { ok: false };
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          ok: true,
          vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        };
      })(),
    }));

    return {
      mode,
      idle,
      play,
      afterPlaylist,
      afterReplay,
      meta,
      software: isSoft(play.renderer || meta.webgl?.renderer || ''),
    };
  } finally {
    await page.close();
  }
}

function toMarkdown(report) {
  const rows = report.modes
    .map((m) => {
      const s = m.play;
      return `| ${m.mode} | ${s.renderer} | ${s.averageFps} | ${s.minimumFps} | ${s.p95FrameTimeMs} | ${s.drawCalls} | ${s.triangles} | ${s.heapMb} |`;
    })
    .join('\n');
  const soft = report.softwareRendererDetected;
  return `# HARDWARE_BROWSER_BENCHMARK

Measured: ${report.measuredAt}
Commit probe URL: ${report.baseUrl}
Browser: ${report.browserVersion}
Headed: yes (no forced GPU flags)
Software renderer: **${soft ? 'YES' : 'no'}**

## Mode table (after Play)

| Mode | Renderer | Avg FPS | Min FPS | p95 | Calls | Triangles | Heap |
| ---- | -------- | ------: | ------: | --: | ----: | --------: | ---: |
${rows}

## Notes

${report.notes.map((n) => `- ${n}`).join('\n')}

Raw JSON: \`agent/reports/browser-benchmark.json\`
`;
}

async function main() {
  const notes = [];
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    notes.push(
      'No DISPLAY — attempting headed launch may fail. Run on the presentation laptop with a real display.',
    );
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: process.env.PERF_CHROME_CHANNEL || undefined,
      // Intentionally NO GPU override flags — measure the machine as the jury sees it.
    });
  } catch (err) {
    notes.push(`channel launch failed (${err.message}); falling back to bundled Chromium headed`);
    browser = await chromium.launch({ headless: false });
  }

  const modes = [];
  try {
    for (const mode of MODES) {
      modes.push(await measureMode(browser, mode, notes));
    }
  } finally {
    await browser.close();
  }

  const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout.trim();

  const report = {
    measuredAt: new Date().toISOString(),
    commit,
    baseUrl: baseUrl().toString(),
    browserVersion: modes[0]?.meta?.userAgent ?? 'unknown',
    softwareRendererDetected: modes.some((m) => m.software),
    modes,
    notes,
  };

  mkdirSync(join(ROOT, 'agent', 'reports'), { recursive: true });
  const jsonPath = join(ROOT, 'agent', 'reports', 'browser-benchmark.json');
  const mdPath = join(ROOT, 'docs', 'HARDWARE_BROWSER_BENCHMARK_LATEST.md');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, toMarkdown(report));

  console.log(
    JSON.stringify(
      {
        ok: true,
        exportOnly,
        softwareRendererDetected: report.softwareRendererDetected,
        demoFps: modes.find((m) => m.mode === 'demo')?.play.averageFps,
        renderer: modes.find((m) => m.mode === 'demo')?.play.renderer,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
