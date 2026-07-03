import { describe, expect, it } from 'vitest';
import { DEMO_STEPS } from './demoSteps';
import { SCENARIOS } from './scenarios';

const scenarioIds = new Set(SCENARIOS.map((scenario) => scenario.id));

describe('demo steps', () => {
  it('have required narrative fields and valid scenarios', () => {
    for (const step of DEMO_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(scenarioIds.has(step.scenarioId)).toBe(true);
      expect(step.relatedCriteria.length).toBeGreaterThan(0);
      expect(step.presenterPhrase).toBeTruthy();
    }
  });
});
