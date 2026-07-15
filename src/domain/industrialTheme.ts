/**
 * Shared industrial visual tokens for `/` continuous twin and `/details` twin.
 * Keeps both modes looking like projections of one system.
 */

export const INDUSTRIAL_PALETTE = {
  background: '#e8eef4',
  backgroundDark: '#0b1220',
  floor: '#d5dde8',
  gridCell: '#c5d0de',
  gridSection: '#9aabbf',
  belt: '#2f3a48',
  beltStripe: '#f1c40f',
  metal: '#7b8796',
  metalDark: '#4a5563',
  frame: '#5b6b7c',
  plastic: '#94a3b8',
  rubber: '#1f2937',
  cardboard: '#b68b58',
  sensorAccent: '#3b82f6',
  routeB: '#16a34a',
  routeC: '#ea580c',
  routeD: '#7c3aed',
  fault: '#ef4444',
  warning: '#f59e0b',
  lightKey: '#f8fafc',
  lightFill: '#d0dae8',
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
