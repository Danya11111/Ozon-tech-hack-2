import { describe, expect, it } from 'vitest';
import { classifyItem } from './classifier';
import { getItem } from '../data/items';
import type { Item } from './types';

describe('classifyItem', () => {
  it('routes normal box to B', () => {
    expect(classifyItem(getItem('SKU-001')).category).toBe('B');
  });

  it('routes oversized box to C', () => {
    expect(classifyItem(getItem('SKU-004')).category).toBe('C');
  });

  it('routes round plate to D', () => {
    expect(classifyItem(getItem('SKU-006')).category).toBe('D');
  });

  it('routes pen with width below 10 mm to C', () => {
    expect(classifyItem(getItem('SKU-009')).category).toBe('C');
  });

  it('keeps C priority when item is oversized and round', () => {
    const item: Item = {
      ...getItem('SKU-005'),
      id: 'TEST-OVERSIZED-ROUND',
      roundness: 0.95,
    };

    const result = classifyItem(item);

    expect(result.category).toBe('C');
    expect(result.dimensionsPass).toBe(false);
    expect(result.roundnessPass).toBe(false);
  });

  it('accepts boundary item 450x320x320 as B', () => {
    expect(classifyItem(getItem('SKU-010')).category).toBe('B');
  });
});
