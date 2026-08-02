/**
 * Shared visual tokens for the continuous digital twin.
 * Ozon light presentation environment (runtime materials / lights only).
 * CSS mirrors these values in `src/styles.css` (:root).
 */

/** Canonical Ozon brand + semantic tokens (source of truth for tests / 3D). */
export const OZON_TOKENS = {
  blue: '#005BFF',
  magenta: '#F1117E',
  darkSpace: '#001A34',
  morning: '#00A2FF',
  green: '#00BE6C',
  orange: '#FFA800',
  white: '#FFFFFF',
  page: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF4FF',
  border: '#DCE6F5',
  muted: '#5F6F82',
} as const;

export const INDUSTRIAL_PALETTE = {
  /** Scene clear / fog — soft Ozon morning surface */
  background: OZON_TOKENS.surfaceSoft,
  backgroundDark: OZON_TOKENS.darkSpace,
  floor: '#E2EAF5',
  gridCell: '#C5D4EA',
  gridSection: OZON_TOKENS.blue,
  belt: '#2f3a48',
  beltStripe: OZON_TOKENS.orange,
  metal: '#7b8796',
  metalDark: '#4a5563',
  frame: '#5b6b7c',
  plastic: '#94a3b8',
  rubber: '#1f2937',
  cardboard: '#b68b58',
  /** Ozon blue — primary technical markers */
  sensorAccent: OZON_TOKENS.blue,
  sensorActive: OZON_TOKENS.morning,
  /** Success / B */
  routeB: OZON_TOKENS.green,
  /** Attention / C */
  routeC: OZON_TOKENS.orange,
  /** Active selection / D accent (magenta used selectively) */
  routeD: OZON_TOKENS.magenta,
  fault: OZON_TOKENS.magenta,
  warning: OZON_TOKENS.orange,
  success: OZON_TOKENS.green,
  lightKey: OZON_TOKENS.white,
  lightFill: OZON_TOKENS.surfaceSoft,
  text: OZON_TOKENS.darkSpace,
} as const;

export const INDUSTRIAL_MATERIALS = {
  steel: { color: INDUSTRIAL_PALETTE.metal, roughness: 0.45, metalness: 0.55 },
  paintedMetal: { color: INDUSTRIAL_PALETTE.frame, roughness: 0.55, metalness: 0.35 },
  beltRubber: { color: INDUSTRIAL_PALETTE.belt, roughness: 0.9, metalness: 0.05 },
  plastic: { color: INDUSTRIAL_PALETTE.plastic, roughness: 0.35, metalness: 0.1 },
  cardboard: { color: INDUSTRIAL_PALETTE.cardboard, roughness: 0.85, metalness: 0.0 },
} as const;

export const CATEGORY_COLORS = {
  B: INDUSTRIAL_PALETTE.routeB,
  C: INDUSTRIAL_PALETTE.routeC,
  D: INDUSTRIAL_PALETTE.routeD,
} as const;
