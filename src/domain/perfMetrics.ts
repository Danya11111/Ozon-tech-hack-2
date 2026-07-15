/**
 * Pure helpers and types for Three.js performance snapshots.
 * Used by PerfCollector (runtime) and unit tests — no R3F/DOM side effects here.
 */

export interface PerfSnapshot {
  mode: string;
  renderer: string;
  averageFps: number;
  minimumFps: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  longFramesOver33: number;
  longFramesOver50: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  heapMb: number;
  dpr: number;
  shadows: boolean;
  antialias: boolean;
  hardwareAccelerated: boolean;
}

export interface FrameTimeStats {
  averageFps: number;
  minimumFps: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  longFramesOver33: number;
  longFramesOver50: number;
}

/** Linear-interpolation percentile on a sorted ascending array. `p` in [0, 1]. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const clamped = Math.min(1, Math.max(0, p));
  const idx = clamped * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const t = idx - lo;
  return sortedAsc[lo] * (1 - t) + sortedAsc[hi] * t;
}

export function computeFrameTimeStats(frameTimesMs: number[]): FrameTimeStats {
  if (frameTimesMs.length === 0) {
    return {
      averageFps: 0,
      minimumFps: 0,
      p95FrameTimeMs: 0,
      p99FrameTimeMs: 0,
      longFramesOver33: 0,
      longFramesOver50: 0,
    };
  }

  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const avgMs = frameTimesMs.reduce((a, b) => a + b, 0) / frameTimesMs.length;
  const maxMs = sorted[sorted.length - 1];

  return {
    averageFps: avgMs > 0 ? 1000 / avgMs : 0,
    minimumFps: maxMs > 0 ? 1000 / maxMs : 0,
    p95FrameTimeMs: percentile(sorted, 0.95),
    p99FrameTimeMs: percentile(sorted, 0.99),
    longFramesOver33: frameTimesMs.filter((t) => t > 33).length,
    longFramesOver50: frameTimesMs.filter((t) => t > 50).length,
  };
}

/** Detect software / CPU renderers (SwiftShader, llvmpipe, etc.). */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|mesa offscreen|microsoft basic render/i.test(
    renderer,
  );
}

export function isHardwareAccelerated(renderer: string): boolean {
  if (!renderer || renderer === 'unknown') return false;
  return !isSoftwareRenderer(renderer);
}

export function emptyPerfSnapshot(partial?: Partial<PerfSnapshot>): PerfSnapshot {
  return {
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
    hardwareAccelerated: true,
    ...partial,
  };
}

/** True when `?perf=1` is present in the current URL. */
export function isPerfQueryEnabled(search?: string): boolean {
  const q =
    search ??
    (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(q).get('perf') === '1';
}

export function roundPerfSnapshot(snap: PerfSnapshot, digits = 2): PerfSnapshot {
  const r = (n: number) => Number(n.toFixed(digits));
  return {
    ...snap,
    averageFps: r(snap.averageFps),
    minimumFps: r(snap.minimumFps),
    p95FrameTimeMs: r(snap.p95FrameTimeMs),
    p99FrameTimeMs: r(snap.p99FrameTimeMs),
    heapMb: r(snap.heapMb),
    dpr: r(snap.dpr),
  };
}
