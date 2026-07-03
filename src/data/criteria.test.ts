import { describe, expect, it } from 'vitest';
import { OZON_CRITERIA } from './criteria';
import { SCENARIOS } from './scenarios';

const scenarioIds = new Set(SCENARIOS.map((scenario) => scenario.id));

describe('OZON criteria', () => {
  it('contains evidence and valid scenario references', () => {
    expect(OZON_CRITERIA.length).toBeGreaterThan(0);

    for (const criterion of OZON_CRITERIA) {
      expect(criterion.title).toBeTruthy();
      expect(criterion.status).toMatch(/covered|partially covered|demo step available/);
      expect(criterion.evidence).toBeTruthy();
      expect(criterion.relatedDoc).toBeTruthy();
      expect(criterion.relatedScenarioIds.length).toBeGreaterThan(0);
      for (const scenarioId of criterion.relatedScenarioIds) {
        expect(scenarioIds.has(scenarioId)).toBe(true);
      }
    }
  });
});
