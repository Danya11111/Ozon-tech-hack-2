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
    // Shadows stay preset-driven on the default route; stage0 prototype opt-in
    // is the only override and never turns shadows unconditionally on.
    expect(sceneSource).toMatch(/const shadowsEnabled = proto \? protoShadows : quality\.shadows/);
    expect(sceneSource).not.toMatch(/shadows=\{true\}/);
  });

  it('keeps console.error only in error boundaries', () => {
    const allowed = new Set([
      '../components/ThreeD/ThreeErrorBoundary.tsx',
      '../pages/MainPage.tsx',
    ]);
    const offenders: string[] = [];
    for (const [path, text] of Object.entries(srcModules)) {
      if (!/console\.error\s*\(/.test(text)) continue;
      if (!allowed.has(path)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
