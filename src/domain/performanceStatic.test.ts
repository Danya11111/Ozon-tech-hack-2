import { describe, it, expect } from 'vitest';
import sceneSource from '../components/ThreeD/SorterDigitalTwinContinuous.tsx?raw';

const srcModules = import.meta.glob(
  ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('performance and production hygiene', () => {
  it('has no console.log in production src', () => {
    const offenders: string[] = [];
    for (const [path, text] of Object.entries(srcModules)) {
      if (/console\.log\s*\(/.test(text)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  it('caps MAX_VISIBLE_ITEMS at 6', () => {
    const match = sceneSource.match(/MAX_VISIBLE_ITEMS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(6);
  });

  it('disables heavy demo effects by default', () => {
    expect(sceneSource).toMatch(/ENABLE_DEMO_EFFECTS\s*=\s*false/);
    expect(sceneSource).toMatch(/shadows=\{false\}/);
  });

  it('keeps console.error only in error boundaries', () => {
    const allowed = new Set([
      '../components/ThreeD/ThreeErrorBoundary.tsx',
      '../pages/MainPage.tsx',
      '../components/ProductDemoSection.tsx',
    ]);
    const offenders: string[] = [];
    for (const [path, text] of Object.entries(srcModules)) {
      if (!/console\.error\s*\(/.test(text)) continue;
      if (!allowed.has(path)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
