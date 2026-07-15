/**
 * Resolve playlist / scenario item ids, including low-confidence variants (SKU-*-LC).
 */

import type { Item } from '../domain/types';
import { getItem, ITEMS } from './items';

/** Strip -LC suffix and apply low confidence when present. */
export function resolveItem(itemId: string): Item {
  if (itemId.endsWith('-LC')) {
    const baseId = itemId.slice(0, -3);
    const base = getItem(baseId);
    return {
      ...base,
      id: itemId,
      confidence: Math.min(base.confidence, 0.58),
    };
  }
  return getItem(itemId);
}

export function findItemOrFallback(itemId: string): Item {
  try {
    return resolveItem(itemId);
  } catch {
    const stripped = itemId.replace(/-LC$/, '');
    return ITEMS.find((i) => i.id === stripped) ?? ITEMS[0];
  }
}
