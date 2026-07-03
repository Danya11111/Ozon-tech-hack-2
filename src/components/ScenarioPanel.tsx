import type { Scenario, ScenarioId } from '../domain/types';

interface ScenarioPanelProps {
  scenarios: Scenario[];
  activeScenarioId: ScenarioId;
  onScenarioChange: (scenarioId: ScenarioId) => void;
}

export default function ScenarioPanel({ scenarios, activeScenarioId, onScenarioChange }: ScenarioPanelProps) {
  return (
    <section className="panel scenario-panel">
      <div className="panel-heading">
        <p className="eyebrow">Scenario panel</p>
        <h2>Jury test cases</h2>
      </div>
      <div className="scenario-buttons">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={scenario.id === activeScenarioId ? 'active' : ''}
            onClick={() => onScenarioChange(scenario.id)}
          >
            <strong>{scenario.name}</strong>
            <span>{scenario.description}</span>
            <em>Goal: {scenario.goal}</em>
            <em>Expected: {scenario.expectedCategorySummary}</em>
            <em>Shows: {scenario.demonstrates}</em>
          </button>
        ))}
      </div>
    </section>
  );
}
