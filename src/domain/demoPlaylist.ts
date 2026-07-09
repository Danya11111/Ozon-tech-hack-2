/**
 * Demo Playlist — 8 showcase cases for the main page auto-demo.
 * Each case demonstrates a specific classification scenario.
 */

import type { Category, ScenarioId } from './types';

export interface PlaylistCase {
  id: string;
  title: string;
  description: string;
  itemId: string;
  scenarioId: ScenarioId;
  expectedCategory: Category;
  warning?: string;
}

/**
 * 8 showcase cases for continuous demo playback.
 * Order is designed for storytelling: B → C → D → edge cases.
 */
export const DEMO_PLAYLIST: PlaylistCase[] = [
  {
    id: 'box_b',
    title: 'Короб 300×200×200',
    description: 'Стандартный короб — габариты проходят, круга нет → B',
    itemId: 'SKU-001',
    scenarioId: 'normal_flow',
    expectedCategory: 'B',
  },
  {
    id: 'lunchbox_b',
    title: 'ЛанчБокс',
    description: 'Компактная упаковка — проходит все проверки → B',
    itemId: 'SKU-002',
    scenarioId: 'boundary_dimensions',
    expectedCategory: 'B',
  },
  {
    id: 'oversized_box_c',
    title: 'Негабаритный короб',
    description: 'Размер 401×300×400 превышает max 450×320×320 по height → C',
    itemId: 'SKU-004',
    scenarioId: 'oversized_item',
    expectedCategory: 'C',
  },
  {
    id: 'small_item_c',
    title: 'Ручка (слишком маленькая)',
    description: 'Width 9mm < min 10mm — не проходит min dimensions → C',
    itemId: 'SKU-009',
    scenarioId: 'boundary_dimensions',
    expectedCategory: 'C',
  },
  {
    id: 'plate_d',
    title: 'Тарелка',
    description: 'Габариты OK, но K=0.95 ≥ 0.7 — круглое сечение → D',
    itemId: 'SKU-006',
    scenarioId: 'round_object',
    expectedCategory: 'D',
  },
  {
    id: 'bottle_d',
    title: 'Бутылка',
    description: 'Цилиндр K=0.92 — требует доупаковки → D',
    itemId: 'SKU-007',
    scenarioId: 'round_object',
    expectedCategory: 'D',
  },
  {
    id: 'c_priority',
    title: 'Негабарит + круглый',
    description: 'Oversized AND round — но C имеет приоритет над D → C',
    itemId: 'SKU-011',
    scenarioId: 'c_priority',
    expectedCategory: 'C',
  },
  {
    id: 'low_confidence',
    title: 'Low confidence fallback',
    description: 'CV confidence < 0.65 — warning, но rule-based решение работает',
    itemId: 'SKU-003-LC',
    scenarioId: 'low_confidence',
    expectedCategory: 'B',
    warning: 'Low confidence is a warning, not a 4th category. Rules still apply.',
  },
];

/**
 * Get playlist case by index (loops).
 */
export function getPlaylistCase(index: number): PlaylistCase {
  return DEMO_PLAYLIST[index % DEMO_PLAYLIST.length];
}

/**
 * Get next playlist index (loops).
 */
export function nextPlaylistIndex(current: number): number {
  return (current + 1) % DEMO_PLAYLIST.length;
}

/**
 * Total playlist length.
 */
export const PLAYLIST_LENGTH = DEMO_PLAYLIST.length;
