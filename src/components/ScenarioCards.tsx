import type { Scenario, ScenarioId } from '../domain/types';

interface Props {
  scenarios: Scenario[];
  activeScenarioId: ScenarioId;
  onScenarioChange: (id: ScenarioId) => void;
}

export default function ScenarioCards({ scenarios, activeScenarioId, onScenarioChange }: Props) {
  return (
    <section className="scenario-cards-section" id="scenarios">
      <div className="section-header">
        <h2>Сценарии тестирования (Jury Test Cases)</h2>
        <p>Выберите сценарий для проверки поведения системы в разных условиях.</p>
      </div>
      
      <div className="scenario-grid">
        {scenarios.map((scenario) => (
          <div 
            key={scenario.id} 
            className={`scenario-card ${scenario.id === activeScenarioId ? 'active' : ''}`}
            onClick={() => onScenarioChange(scenario.id)}
          >
            <div className="scenario-card-header">
              <h3>{scenario.name}</h3>
              {scenario.id === activeScenarioId && <span className="active-badge">Выбран</span>}
            </div>
            <p className="scenario-desc">{scenario.description}</p>
            <div className="scenario-meta">
              <div className="meta-item">
                <span className="meta-label">Цель:</span>
                <span className="meta-value">{scenario.goal}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Результат:</span>
                <span className="meta-value">{scenario.expectedCategorySummary}</span>
              </div>
            </div>
            <button className="btn-secondary btn-small mt-auto">Применить</button>
          </div>
        ))}
      </div>
    </section>
  );
}
