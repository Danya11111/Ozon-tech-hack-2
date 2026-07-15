#!/usr/bin/env node
/**
 * Headed / hardware-preferring GPU baseline.
 * Samples window.__PERF_SNAPSHOT__ for quality modes low|medium|high|demo.
 *
 * Usage: npm run perf:gpu
 * Env:
 *   PLAYWRIGHT_BASE_URL  default http://127.0.0.1:3100
 *   PERF_USE_XVFB=0      skip auto xvfb when DISPLAY unset
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MODES = ['low', 'medium', 'high', 'demo'];

const GPU_ARGS = [
  '--use-gl=angle',
  '--use-angle=gl-egl',
  '--enable-webgl',
  '--enable-webgl2',
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--enable-precise-memory-info',
  '--enable-unsafe-swiftshader', // fallback if EGL/NVIDIA path unavailable in CI/coder
];

function resolveBaseUrl() {
  const raw = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
  return new URL(raw.includes('://') ? raw : `http://${raw}`);
}

function urlForMode(mode) {
  const u = resolveBaseUrl();
  u.searchParams.set('perf', '1');
  u.searchParams.set('quality', mode);
  return u.toString();
}

function isSoftwareRenderer(renderer = '') {
  return /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i.test(
    renderer,
  );
}

function emptySnap(mode = 'demo') {
  return {
    mode,
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
    hardwareAccelerated: true,
  };
}

async function sampleSnapshot(page) {
  const snap = await page.evaluate(() => {
    const s = window.__PERF_SNAPSHOT__;
    return s ? { ...s } : null;
  });
  return snap ?? emptySnap();
}

async function measureMode(browser, mode, notes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = urlForMode(mode);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('canvas', { timeout: 45_000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__PERF_RESET__?.());
    await page.waitForTimeout(2500);
    const idle = await sampleSnapshot(page);

    await page.evaluate(() => window.__PERF_RESET__?.());
    await page
      .getByTestId('demo-play')
      .click({ timeout: 8_000 })
      .catch(() => notes.push(`${mode}: play click skipped`));
    await page.waitForTimeout(4500);
    const play = await sampleSnapshot(page);

    // memory stability probe: seek + replay light
    const heapBefore = play.heapMb;
    const geoBefore = play.geometries;
    const texBefore = play.textures;
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('demo-case-0').click().catch(() => undefined);
      await page.waitForTimeout(400);
      await page.getByTestId('demo-play').click().catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    const afterReplay = await sampleSnapshot(page);

    return {
      mode,
      url,
      idle,
      play,
      afterReplay,
      heapDeltaMb: Number((afterReplay.heapMb - heapBefore).toFixed(2)),
      geometriesDelta: afterReplay.geometries - geoBefore,
      texturesDelta: afterReplay.textures - texBefore,
      software: isSoftwareRenderer(play.renderer || idle.renderer),
    };
  } finally {
    await page.close();
  }
}

function renderMarkdown(report) {
  const soft = report.softwareRendererDetected;
  const rows = report.modes
    .map((m) => {
      const s = m.play;
      return `| ${m.mode} | ${s.renderer} | ${s.averageFps} | ${s.minimumFps} | ${s.p95FrameTimeMs} | ${s.drawCalls} | ${s.triangles} | ${s.heapMb} |`;
    })
    .join('\n');

  const demo = report.modes.find((m) => m.mode === 'demo')?.play ?? emptySnap();
  let verdict = 'PARTIAL — software/headless diagnostic only';
  if (!soft && demo.averageFps >= 55 && demo.minimumFps >= 40 && demo.p95FrameTimeMs <= 20) {
    verdict = 'PASS — Excellent Demo GPU';
  } else if (!soft && demo.averageFps >= 30 && demo.minimumFps >= 24 && demo.p95FrameTimeMs <= 33) {
    verdict = 'PASS — Acceptable Demo GPU';
  } else if (!soft && (demo.averageFps < 30 || demo.p95FrameTimeMs > 40)) {
    verdict = 'FAIL — Demo GPU below live demo bar';
  } else if (soft) {
    verdict = 'NOT A GPU BASELINE — software renderer (SwiftShader/llvmpipe/etc.)';
  }

  return `# HEADED_GPU_PERFORMANCE_REPORT

Measured: ${report.measuredAt}  
Commit: \`${report.commit}\`  
Base URL: ${report.baseUrl}  
Display: ${report.displayNote}  
Software renderer detected: **${soft ? 'YES' : 'no'}**  
Verdict: **${verdict}**

## Notes

${report.notes.map((n) => `- ${n}`).join('\n')}

## Mode table (after Play)

| Mode | Renderer | Avg FPS | Min FPS | p95 | Calls | Triangles | Heap |
| ---- | -------- | ------: | ------: | --: | ----: | --------: | ---: |
${rows}

## Memory after 3 seek+replay (demo mode)

\`\`\`
${JSON.stringify(
  report.modes.find((m) => m.mode === 'demo')
    ? {
        heapDeltaMb: report.modes.find((m) => m.mode === 'demo').heapDeltaMb,
        geometriesDelta: report.modes.find((m) => m.mode === 'demo').geometriesDelta,
        texturesDelta: report.modes.find((m) => m.mode === 'demo').texturesDelta,
      }
    : {},
  null,
  2,
)}
\`\`\`

## Prior software/headless WebGL diagnostic baseline (reference only)

\`\`\`
Average FPS: 9.6
Minimum FPS: 3.3
p95 frame time: 200 ms
\`\`\`

Do **not** treat the above as live-demo GPU characteristics.

## Chromium launch args

\`\`\`
${report.launchArgs.join(' ')}
\`\`\`

Raw JSON: \`agent/reports/gpu-baseline.json\`
`;
}

async function runMeasurement() {
  const notes = [];
  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  let displayNote = hasDisplay
    ? `headed (${process.env.DISPLAY || process.env.WAYLAND_DISPLAY})`
    : 'no DISPLAY — Chromium headless';

  if (!hasDisplay) {
    notes.push(
      'No DISPLAY/WAYLAND_DISPLAY. Prefer xvfb-run wrapper (auto) for a virtual headed session.',
    );
  } else {
    notes.push('Headed Chromium with GPU-preferring flags.');
  }
  notes.push('PerfCollector only with ?perf=1; quality forced via ?quality=.');
  notes.push('Prior headless ~9.6 FPS is labeled software/headless WebGL diagnostic baseline.');

  const launchArgs = [...GPU_ARGS];
  const browser = await chromium.launch({
    headless: !hasDisplay,
    args: launchArgs,
  });

  const modes = [];
  try {
    for (const mode of MODES) {
      modes.push(await measureMode(browser, mode, notes));
    }
  } finally {
    await browser.close();
  }

  const softwareRendererDetected = modes.some((m) => m.software);
  const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout.trim();

  const report = {
    measuredAt: new Date().toISOString(),
    commit,
    baseUrl: resolveBaseUrl().toString(),
    headed: hasDisplay,
    displayNote,
    launchArgs,
    softwareRendererDetected,
    modes,
    notes,
  };

  mkdirSync(join(ROOT, 'agent', 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'agent', 'reports', 'gpu-baseline.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(ROOT, 'docs', 'HEADED_GPU_PERFORMANCE_REPORT.md'), renderMarkdown(report));

  console.log(
    JSON.stringify(
      {
        ok: true,
        headed: hasDisplay,
        softwareRendererDetected,
        demoFps: modes.find((m) => m.mode === 'demo')?.play.averageFps,
        renderer: modes.find((m) => m.mode === 'demo')?.play.renderer,
        reports: ['docs/HEADED_GPU_PERFORMANCE_REPORT.md', 'agent/reports/gpu-baseline.json'],
      },
      null,
      2,
    ),
  );
}

async function main() {
  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  const allowXvfb = process.env.PERF_USE_XVFB !== '0';
  const xvfb = existsSync('/usr/bin/xvfb-run');

  // Re-exec under xvfb so Chromium gets a virtual DISPLAY (better chance at real GL).
  if (!hasDisplay && allowXvfb && xvfb && !process.env.PERF_UNDER_XVFB) {
    console.log('Re-launching under xvfb-run for virtual headed session…');
    const env = { ...process.env, PERF_UNDER_XVFB: '1' };
    delete env.DISPLAY; // let xvfb-run assign the real display
    const r = spawnSync(
      'xvfb-run',
      ['-a', '-s', '-screen 0 1440x900x24', 'node', fileURLToPath(import.meta.url)],
      {
        cwd: ROOT,
        env,
        stdio: 'inherit',
      },
    );
    process.exit(r.status ?? 1);
  }

  await runMeasurement();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
