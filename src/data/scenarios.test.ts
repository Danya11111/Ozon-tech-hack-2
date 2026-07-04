import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './scenarios';
import type { ScenarioId } from '../domain/types';

const expectedIds: ScenarioId[] = [
  'normal_flow',
  'oversized_item',
  'round_object',
  'c_priority',
  'boundary_dimensions',
  'close_items',
  'low_confidence',
  'jam',
  'emergency_stop',
];

describe('scenarios', () => {
  it('contains every expected scenario id', () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);

    expect(ids).toEqual(expectedIds);
  });

  it('contains items and demo metadata for every scenario', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.items.length).toBeGreaterThan(0);
      expect(scenario.goal.length).toBeGreaterThan(0);
      expect(scenario.expectedCategorySummary.length).toBeGreaterThan(0);
      expect(scenario.demonstrates.length).toBeGreaterThan(0);
    }
  });
});
