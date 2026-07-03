import type { Item } from '../domain/types';

export const ITEMS: Item[] = [
  {
    id: 'SKU-001',
    name: 'Box 300x200x200',
    dimensionsMm: { width: 300, depth: 200, height: 200 },
    roundness: 0.12,
    confidence: 0.94,
    shape: 'box',
    expectedCategory: 'B',
  },
  {
    id: 'SKU-002',
    name: 'Lunchbox 201x152x62',
    dimensionsMm: { width: 201, depth: 152, height: 62 },
    roundness: 0.22,
    confidence: 0.91,
    shape: 'rectangular prism',
    expectedCategory: 'B',
  },
  {
    id: 'SKU-003',
    name: 'Detergent 259x179x278',
    dimensionsMm: { width: 259, depth: 179, height: 278 },
    roundness: 0.38,
    confidence: 0.88,
    shape: 'bottle box',
    expectedCategory: 'B',
  },
  {
    id: 'SKU-004',
    name: 'Oversized box 401x300x400',
    dimensionsMm: { width: 401, depth: 300, height: 400 },
    roundness: 0.18,
    confidence: 0.9,
    shape: 'oversized box',
    expectedCategory: 'C',
  },
  {
    id: 'SKU-005',
    name: 'Pouf 489x264x489',
    dimensionsMm: { width: 489, depth: 264, height: 489 },
    roundness: 0.74,
    confidence: 0.86,
    shape: 'soft bulky item',
    expectedCategory: 'C',
  },
  {
    id: 'SKU-006',
    name: 'Plate 210x209x27',
    dimensionsMm: { width: 210, depth: 209, height: 27 },
    roundness: 0.95,
    confidence: 0.89,
    shape: 'round plate',
    expectedCategory: 'D',
  },
  {
    id: 'SKU-007',
    name: 'Bottle 91x91x305',
    dimensionsMm: { width: 91, depth: 91, height: 305 },
    roundness: 0.92,
    confidence: 0.93,
    shape: 'cylinder bottle',
    expectedCategory: 'D',
  },
  {
    id: 'SKU-008',
    name: 'Cylinder 435x50x43',
    dimensionsMm: { width: 435, depth: 50, height: 43 },
    roundness: 0.88,
    confidence: 0.87,
    shape: 'long cylinder',
    expectedCategory: 'D',
  },
  {
    id: 'SKU-009',
    name: 'Pen 9x13x148',
    dimensionsMm: { width: 9, depth: 13, height: 148 },
    roundness: 0.66,
    confidence: 0.84,
    shape: 'thin item',
    expectedCategory: 'C',
  },
  {
    id: 'SKU-010',
    name: 'Boundary box 450x320x320',
    dimensionsMm: { width: 450, depth: 320, height: 320 },
    roundness: 0.2,
    confidence: 0.9,
    shape: 'boundary box',
    expectedCategory: 'B',
  },
];

export function getItem(id: string): Item {
  const item = ITEMS.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Unknown item id: ${id}`);
  }
  return item;
}
