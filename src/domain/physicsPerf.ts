/**
 * Stage 2E — physics step timing ring buffer (no React state in hot path).
 * Exposed via window.__PHYSICS_PERF__ when ?perf=1 or ?physicsPerf=1.
 */
export interface PhysicsPerfSnapshot {
  count: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  over4Ms: number;
  over8Ms: number;
  lastSubsteps: number;
  activeBodies: number;
  sleepingBodies: number;
  colliders: number;
  /** Best-effort contact pairs (0 if API unavailable). */
  contactPairs: number;
  timestepSec: number;
  maxSubsteps: number;
}

const MAX_SAMPLES = 1800;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

export class PhysicsPerfSampler {
  private samples: number[] = [];
  private lastSubsteps = 0;
  readonly timestepSec: number;
  readonly maxSubsteps: number;

  constructor(timestepSec: number, maxSubsteps: number) {
    this.timestepSec = timestepSec;
    this.maxSubsteps = maxSubsteps;
  }

  reset() {
    this.samples = [];
    this.lastSubsteps = 0;
  }

  pushStepMs(ms: number, substepsThisFrame: number) {
    this.samples.push(ms);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    this.lastSubsteps = substepsThisFrame;
  }

  snapshot(worldMeta?: {
    activeBodies?: number;
    sleepingBodies?: number;
    colliders?: number;
    contactPairs?: number;
  }): PhysicsPerfSnapshot {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = this.samples.reduce((s, v) => s + v, 0);
    return {
      count: n,
      avgMs: n ? sum / n : 0,
      medianMs: n ? sorted[Math.floor(n * 0.5)] ?? 0 : 0,
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      maxMs: n ? sorted[n - 1] ?? 0 : 0,
      over4Ms: this.samples.filter((v) => v > 4).length,
      over8Ms: this.samples.filter((v) => v > 8).length,
      lastSubsteps: this.lastSubsteps,
      activeBodies: worldMeta?.activeBodies ?? 0,
      sleepingBodies: worldMeta?.sleepingBodies ?? 0,
      colliders: worldMeta?.colliders ?? 0,
      contactPairs: worldMeta?.contactPairs ?? 0,
      timestepSec: this.timestepSec,
      maxSubsteps: this.maxSubsteps,
    };
  }
}

export function isPhysicsPerfQueryEnabled(search = typeof window !== 'undefined' ? window.location.search : ''): boolean {
  const q = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  return q.get('physicsPerf') === '1' || q.get('perf') === '1';
}
