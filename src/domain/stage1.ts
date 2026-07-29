/**
 * Stage 1 — real-models verification mode (query-param config).
 *
 *   ?stage1=1&verify=real-models            → verification overlays for the current SKU
 *   ?stage1=1&verify=real-models&sku=SKU-007 → pin verification to a specific SKU
 *
 * Read-only debug instrumentation: never touches business state or results.
 * Mirrors the Stage 0 prototype-mode pattern (stage0.ts).
 */

export interface Stage1Config {
  /** Master switch for Stage 1 tooling */
  enabled: boolean;
  /** Verification overlay mode (null = off) */
  verify: 'real-models' | null;
  /** Pinned SKU (null = follow the currently playing case) */
  sku: string | null;
}

const SKU_PATTERN = /^SKU-\d{3}$/;

export function parseStage1Config(search: string): Stage1Config {
  const params = new URLSearchParams(search);
  const enabled = params.get('stage1') === '1';
  const verify = params.get('verify') === 'real-models' ? 'real-models' : null;
  const skuRaw = params.get('sku');
  const sku = skuRaw && SKU_PATTERN.test(skuRaw) ? skuRaw : null;
  return { enabled, verify, sku };
}

export const STAGE1_DISABLED: Stage1Config = { enabled: false, verify: null, sku: null };
