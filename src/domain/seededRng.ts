/**
 * Deterministic PRNG (Mulberry32) for reproducible demo variability.
 */

export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small signed offset in [-amplitude, +amplitude]. */
export function seededOffset(rng: () => number, amplitude: number): number {
  return (rng() * 2 - 1) * amplitude;
}

export const DEFAULT_DEMO_SEED = 20260715;
