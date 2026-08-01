import { describe, expect, it } from 'vitest';
import {
  classifyItem,
  DIMENSION_LIMITS,
  OFFICIAL_RULE_LABELS,
  dimensionsPassOfficial,
  isCircularCrossSection,
} from './classifier';
import { getItem, ITEMS } from '../data/items';
import { DEMO_PLAYLIST } from './demoPlaylist';
import { resolveItem } from '../data/resolveItem';
import type { Category, Item } from './types';

const VALID_CATEGORIES: Category[] = ['B', 'D', 'C'];

function itemWith(
  dimensionsMm: Item['dimensionsMm'],
  roundness: number,
  confidence = 0.9,
): Item {
  return {
    ...getItem('SKU-001'),
    id: 'TEST-BOUNDARY',
    dimensionsMm,
    roundness,
    confidence,
    expectedCategory: 'B',
  };
}

describe('classifyItem', () => {
  it('uses official Track 3 constants (exclusive bounds, K > 0.8)', () => {
    expect(DIMENSION_LIMITS.min).toEqual({ width: 10, depth: 10, height: 10 });
    expect(DIMENSION_LIMITS.max).toEqual({ width: 450, depth: 320, height: 320 });
    expect(DIMENSION_LIMITS.roundnessThreshold).toBe(0.8);
    expect(OFFICIAL_RULE_LABELS.minDisplay).toContain('10×10×10');
    expect(OFFICIAL_RULE_LABELS.roundnessDisplay).toBe('K > 0.8');
    expect(JSON.stringify(DIMENSION_LIMITS)).not.toContain('"height":2');
    expect(JSON.stringify(DIMENSION_LIMITS)).not.toMatch(/0\.7/);
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

  it('routes pen with width below min to C', () => {
    expect(classifyItem(getItem('SKU-009')).category).toBe('C');
  });

  it('keeps C priority when item is oversized and round', () => {
    const result = classifyItem(getItem('SKU-011'));

    expect(result.category).toBe('C');
    expect(result.dimensionsPass).toBe(false);
    expect(result.roundnessPass).toBe(false);
    expect(isCircularCrossSection(getItem('SKU-011').roundness)).toBe(true);
  });

  it('rejects exclusive-max boundary 450×320×320 as C', () => {
    const item = itemWith({ width: 450, depth: 320, height: 320 }, 0.2);
    expect(classifyItem(item).category).toBe('C');
    expect(dimensionsPassOfficial(item.dimensionsMm)).toBe(false);
  });

  it('accepts near-max 449×319×319 as B when not round', () => {
    expect(classifyItem(getItem('SKU-010')).category).toBe('B');
  });

  it('rejects height at min boundary 10 mm as C', () => {
    const item = itemWith({ width: 100, depth: 100, height: 10 }, 0.5);
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
      expect(result.warnings.some((warning) => warning.toLowerCase().includes('confidence'))).toBe(true);
    }
  });
});

describe('official Track 3 classification boundaries', () => {
  it('1. 11×11×11, K=0.50 → B', () => {
    expect(classifyItem(itemWith({ width: 11, depth: 11, height: 11 }, 0.5)).category).toBe('B');
  });

  it('2. 9×20×20, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 9, depth: 20, height: 20 }, 0.5)).category).toBe('C');
  });

  it('3. 20×9×20, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 20, depth: 9, height: 20 }, 0.5)).category).toBe('C');
  });

  it('4. 20×20×9, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 20, depth: 20, height: 9 }, 0.5)).category).toBe('C');
  });

  it('5. 10×20×20, K=0.50 → C (min exclusive)', () => {
    expect(classifyItem(itemWith({ width: 10, depth: 20, height: 20 }, 0.5)).category).toBe('C');
  });

  it('6. 20×10×20, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 20, depth: 10, height: 20 }, 0.5)).category).toBe('C');
  });

  it('7. 20×20×10, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 20, depth: 20, height: 10 }, 0.5)).category).toBe('C');
  });

  it('8. 451×100×100, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 451, depth: 100, height: 100 }, 0.5)).category).toBe('C');
  });

  it('9. 100×321×100, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 321, height: 100 }, 0.5)).category).toBe('C');
  });

  it('10. 100×100×321, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 100, height: 321 }, 0.5)).category).toBe('C');
  });

  it('11. 450×100×100, K=0.50 → C (max exclusive)', () => {
    expect(classifyItem(itemWith({ width: 450, depth: 100, height: 100 }, 0.5)).category).toBe('C');
  });

  it('12. 100×320×100, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 320, height: 100 }, 0.5)).category).toBe('C');
  });

  it('13. 100×100×320, K=0.50 → C', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 100, height: 320 }, 0.5)).category).toBe('C');
  });

  it('14. 449×319×319, K=0.50 → B', () => {
    expect(classifyItem(itemWith({ width: 449, depth: 319, height: 319 }, 0.5)).category).toBe('B');
  });

  it('15. admissible dims, K=0.79 → B', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 100, height: 100 }, 0.79)).category).toBe('B');
  });

  it('16. admissible dims, K=0.80 → B (not round)', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 100, height: 100 }, 0.8)).category).toBe('B');
    expect(isCircularCrossSection(0.8)).toBe(false);
  });

  it('17. admissible dims, K=0.8001 → D', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 100, height: 100 }, 0.8001)).category).toBe('D');
  });

  it('18. admissible dims, K=0.95 → D', () => {
    expect(classifyItem(itemWith({ width: 100, depth: 100, height: 100 }, 0.95)).category).toBe('D');
  });

  it('19. oversized + K=0.95 → C (priority)', () => {
    expect(classifyItem(itemWith({ width: 500, depth: 100, height: 100 }, 0.95)).category).toBe('C');
  });

  it('20. low confidence does not cancel C-priority', () => {
    const result = classifyItem({
      ...itemWith({ width: 500, depth: 300, height: 300 }, 0.95, 0.4),
      id: 'LC-C-PRIO',
    });
    expect(result.category).toBe('C');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('21–22. every demo SKU matches live classifier and ROUTE_TO_*', () => {
    for (const playlistCase of DEMO_PLAYLIST.filter((c) => !c.faultType)) {
      const item = resolveItem(playlistCase.itemId);
      const result = classifyItem(item);
      expect(result.category).toBe(playlistCase.expectedCategory);
      expect(`ROUTE_TO_${result.category}`).toBe(`ROUTE_TO_${playlistCase.expectedCategory}`);
    }
  });

  it('23. UI rule labels expose official exclusive values', () => {
    expect(OFFICIAL_RULE_LABELS.minDisplay).toBe('> 10×10×10 мм');
    expect(OFFICIAL_RULE_LABELS.maxDisplay).toBe('< 450×320×320 мм');
    expect(OFFICIAL_RULE_LABELS.roundnessDisplay).toBe('K > 0.8');
  });

  it('24. serialized settings do not contain 2 mm min height or 0.7 threshold', () => {
    const serialized = JSON.stringify({
      limits: DIMENSION_LIMITS,
      labels: OFFICIAL_RULE_LABELS,
    });
    expect(serialized).not.toMatch(/10×10×2|10 x 10 x 2|height":2[^0-9]/);
    expect(serialized).not.toMatch(/roundnessThreshold":0\.7|"0\.7"/);
    expect(serialized).toContain('0.8');
    expect(serialized).toContain('"height":10');
  });

  it('catalog expectedCategory matches classifier for every SKU', () => {
    for (const item of ITEMS) {
      expect(classifyItem(item).category).toBe(item.expectedCategory);
    }
  });
});
