/**
 * R3F performance sampler. Mount only when ?perf=1 or enabled prop.
 * Exposes window.__PERF_SNAPSHOT__ (getter) and window.__PERF_RESET__.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { WebGLRenderer } from 'three';
import {
  computeFrameTimeStats,
  emptyPerfSnapshot,
  isHardwareAccelerated,
  isPerfQueryEnabled,
  roundPerfSnapshot,
  type PerfSnapshot,
} from '../../domain/perfMetrics';

const MAX_SAMPLES = 600;

export interface PerfCollectorProps {
  /** Force-enable even without ?perf=1 */
  enabled?: boolean;
  mode?: string;
  shadows?: boolean;
  antialias?: boolean;
}

function readRendererString(gl: WebGLRenderer): string {
  try {
    const ctx = gl.getContext() as WebGLRenderingContext;
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      return String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? 'unknown');
    }
    return String(ctx.getParameter(ctx.RENDERER) ?? 'unknown');
  } catch {
    return 'unknown';
  }
}

function readHeapMb(): number {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  if (!mem) return 0;
  return mem.usedJSHeapSize / (1024 * 1024);
}

function PerfCollectorInner({
  mode = 'demo',
  shadows = false,
  antialias = false,
}: Omit<PerfCollectorProps, 'enabled'>) {
  const { gl } = useThree();
  const frameTimes = useRef<number[]>([]);
  const lastTs = useRef(0);
  const meta = useRef({ mode, shadows, antialias, renderer: 'unknown' });
  meta.current = { ...meta.current, mode, shadows, antialias };

  const buildSnapshot = (): PerfSnapshot => {
    const stats = computeFrameTimeStats(frameTimes.current);
    const info = gl.info;
    const renderer = meta.current.renderer || readRendererString(gl);
    return roundPerfSnapshot(
      emptyPerfSnapshot({
        mode: meta.current.mode,
        renderer,
        ...stats,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        heapMb: readHeapMb(),
        dpr: gl.getPixelRatio(),
        shadows: meta.current.shadows,
        antialias: meta.current.antialias,
        hardwareAccelerated: isHardwareAccelerated(renderer),
      }),
    );
  };

  useEffect(() => {
    meta.current.renderer = readRendererString(gl);

    const reset = () => {
      frameTimes.current = [];
      lastTs.current = 0;
      gl.info.reset();
    };

    Object.defineProperty(window, '__PERF_SNAPSHOT__', {
      configurable: true,
      enumerable: true,
      get: () => buildSnapshot(),
    });
    window.__PERF_RESET__ = reset;

    return () => {
      reset();
      try {
        delete window.__PERF_SNAPSHOT__;
      } catch {
        /* ignore */
      }
      delete window.__PERF_RESET__;
    };
  }, [gl]);

  useFrame((_state, delta) => {
    // Prefer measured rAF delta; fall back to clock delta (seconds → ms)
    const now = performance.now();
    let dtMs: number;
    if (lastTs.current > 0) {
      dtMs = now - lastTs.current;
    } else {
      dtMs = delta * 1000;
    }
    lastTs.current = now;

    // Ignore absurd spikes from tab backgrounding
    if (dtMs <= 0 || dtMs > 500) return;

    const buf = frameTimes.current;
    buf.push(dtMs);
    if (buf.length > MAX_SAMPLES) buf.shift();
  });

  return null;
}

/**
 * Safe wrapper: returns null unless enabled or ?perf=1.
 * Keeps demos free of sampling overhead by default.
 */
export default function PerfCollector({
  enabled,
  mode,
  shadows,
  antialias,
}: PerfCollectorProps) {
  const active = enabled === true || (enabled !== false && isPerfQueryEnabled());
  if (!active) return null;
  return <PerfCollectorInner mode={mode} shadows={shadows} antialias={antialias} />;
}
