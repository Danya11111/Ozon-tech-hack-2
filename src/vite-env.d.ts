/// <reference types="vite/client" />

import type { PerfSnapshot } from './domain/perfMetrics';

declare global {
  interface Window {
    /** Live Three.js perf snapshot (getter) — only when ?perf=1 / PerfCollector mounted */
    __PERF_SNAPSHOT__?: PerfSnapshot;
    /** Clear frame-time samples and gl.info counters */
    __PERF_RESET__?: () => void;
  }
}

export {};
