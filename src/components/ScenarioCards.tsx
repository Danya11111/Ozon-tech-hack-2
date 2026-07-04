import type { Scenario, ScenarioId } from '../domain/types';

interface Props {
  scenarios: Scenario[];
  activeScenarioId: ScenarioId;
  onScenarioChange: (id: ScenarioId) => void;
}

const SCENARIO_UI: Record<
  ScenarioId,
  { title: string; summary: string; badge: string; badgeTone: 'b' | 'c' | 'd' | 'mixed' | 'fault' }
> = {
  normal_flow: {
    title: 'Обычный товар',
    summary: 'Стандартный поток с маршрутизацией в B, C и D.',
    badge: 'B / C / D',
    badgeTone: 'mixed',
  },
  oversized_item: {
    title: 'Негабарит',
    summary: 'Габариты превышают лимит — приоритет зоны C.',
    badge: 'Зона C',
    badgeTone: 'c',
  },
  round_object: {
    title: 'Круглый объект',
    summary: 'Габариты проходят, но круглое сечение ведёт в D.',
    badge: 'Зона D',
    badgeTone: 'd',
  },
  c_priority: {
    title: 'C-priority',
    summary: 'Негабарит + круглый: габариты важнее формы, маршрут только в C.',
    badge: 'C priority',
    badgeTone: 'c',
  },
  boundary_dimensions: {
    title: 'Пограничные размеры',
    summary: 'Проверка строгих min/max границ габаритов.',
    badge: 'B / C',
    badgeTone: 'mixed',
  },
  low_confidence: {
    title: 'Низкая уверенность CV',
    summary: 'Предупреждение CV и rule-based fallback.',
    badge: 'Fallback',
    badgeTone: 'b',
  },
  close_items: {
    title: 'Очередь товаров',
    summary: 'Близкие товары обрабатываются по одному циклу.',
    badge: 'Queue',
    badgeTone: 'mixed',
  },
  jam: {
    title: 'Застревание',
    summary: 'Jam у gate переводит линию в FAULT.',
    badge: 'FAULT',
    badgeTone: 'fault',
  },
  emergency_stop: {
    title: 'Аварийная остановка',
    summary: 'EMERGENCY_STOP останавливает движение до Reset.',
    badge: 'E-STOP',
    badgeTone: 'fault',
  },
};

export default function ScenarioCards({ scenarios, activeScenarioId, onScenarioChange }: Props) {
  return (
    <section className="scenario-cards-section" id="scenarios" aria-labelledby="scenarios-title">
      <div className="section-header">
        <h2 id="scenarios-title">Сценарии</h2>
        <p>Выберите кейс жюри: обычный поток, негабарит, круглое сечение, очередь или авария.</p>
      </div>

      <div className="scenario-grid">
        {scenarios.map((scenario) => {
          const ui = SCENARIO_UI[scenario.id];
          const active = scenario.id === activeScenarioId;

          return (
            <article
              key={scenario.id}
              className={`scenario-card ${active ? 'active' : ''}`}
            >
              <div className="scenario-card-header">
                <h3>{ui.title}</h3>
                <span className={`result-badge tone-${ui.badgeTone}`}>{ui.badge}</span>
              </div>
              <p className="scenario-desc">{ui.summary}</p>
              <p className="scenario-expected">
                <span>Ожидаемый результат</span>
                <strong>{scenario.expectedCategorySummary}</strong>
              </p>
              <button
                type="button"
                className={active ? 'btn-primary' : 'btn-secondary'}
                onClick={() => onScenarioChange(scenario.id)}
              >
                {active ? 'Выбран' : 'Показать'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
