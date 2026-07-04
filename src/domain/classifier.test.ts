import { describe, expect, it } from 'vitest';
import { classifyItem, DIMENSION_LIMITS } from './classifier';
import { getItem } from '../data/items';
import type { Category, Item } from './types';

const VALID_CATEGORIES: Category[] = ['B', 'C', 'D'];

describe('classifyItem', () => {
  it('uses min dimensions 10×10×10 mm', () => {
    expect(DIMENSION_LIMITS.min).toEqual({ width: 10, depth: 10, height: 10 });
    expect(DIMENSION_LIMITS.max).toEqual({ width: 450, depth: 320, height: 320 });
    expect(DIMENSION_LIMITS.roundnessThreshold).toBe(0.8);
  });

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
    const result = classifyItem(getItem('SKU-011'));

    expect(result.category).toBe('C');
    expect(result.dimensionsPass).toBe(false);
    expect(result.roundnessPass).toBe(false);
  });

  it('accepts boundary item 450x320x320 as B', () => {
    expect(classifyItem(getItem('SKU-010')).category).toBe('B');
  });

  it('rejects height below 10 mm as C', () => {
    const item: Item = {
      ...getItem('SKU-001'),
      id: 'TEST-LOW-HEIGHT',
      dimensionsMm: { width: 100, depth: 100, height: 9 },
    };
    expect(classifyItem(item).category).toBe('C');
    expect(classifyItem(item).dimensionsPass).toBe(false);
  });

  it('low confidence does not create a 4th class', () => {
    const lowConfidenceItems: Item[] = [
      { ...getItem('SKU-001'), id: 'LC-B', confidence: 0.4 },
      { ...getItem('SKU-004'), id: 'LC-C', confidence: 0.4 },
      { ...getItem('SKU-006'), id: 'LC-D', confidence: 0.4 },
      { ...getItem('SKU-011'), id: 'LC-C-PRIORITY', confidence: 0.4 },
    ];

    for (const item of lowConfidenceItems) {
      const result = classifyItem(item);
      expect(VALID_CATEGORIES).toContain(result.category);
      expect(result.category === 'B' || result.category === 'C' || result.category === 'D').toBe(true);
      expect(result.warnings.some((warning) => warning.toLowerCase().includes('confidence'))).toBe(true);
    }
  });
});
