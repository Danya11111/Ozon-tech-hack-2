import type { ScenarioId } from '../domain/types';
import { OFFICIAL_RULE_LABELS } from '../domain/classifier';

interface CriteriaCard {
  id: string;
  title: string;
  evidence: string;
  status: 'covered' | 'demo';
  linkedScenario: ScenarioId;
  linkedLabel: string;
}

const PRODUCT_CRITERIA: CriteriaCard[] = [
  {
    id: 'classification',
    title: 'Классификация',
    evidence: 'Rule-based дерево решений выдаёт категорию B/C/D для каждого SKU.',
    status: 'covered',
    linkedScenario: 'normal_flow',
    linkedLabel: 'Обычный товар',
  },
  {
    id: 'dimensions',
    title: 'Габариты',
    evidence: 'Проверка min/max размеров до анализа формы.',
    status: 'covered',
    linkedScenario: 'oversized_item',
    linkedLabel: 'Негабарит',
  },
  {
    id: 'round-section',
    title: 'Круг в сечении',
    evidence: `${OFFICIAL_RULE_LABELS.roundnessDisplay} направляет товар в зону D.`,
    status: 'covered',
    linkedScenario: 'round_object',
    linkedLabel: 'Круглый объект',
  },
  {
    id: 'rule-priority',
    title: 'Приоритет правил',
    evidence: 'Сначала габариты (C), затем форма (D). Негабарит + круглый → только C.',
    status: 'covered',
    linkedScenario: 'c_priority',
    linkedLabel: 'C-priority',
  },
  {
    id: 'routing',
    title: 'Маршрутизация B/C/D',
    evidence: 'Категория превращается в команду ROUTE_TO_* и физический маршрут.',
    status: 'covered',
    linkedScenario: 'normal_flow',
    linkedLabel: 'Обычный товар',
  },
  {
    id: 'cycle-time',
    title: 'Cycle time',
    evidence: 'Метрики показывают длительность цикла и throughput.',
    status: 'covered',
    linkedScenario: 'close_items',
    linkedLabel: 'Очередь товаров',
  },
  {
    id: 'faults',
    title: 'Нештатные ситуации',
    evidence: 'Jam переводит систему в FAULT и останавливает конвейер.',
    status: 'demo',
    linkedScenario: 'jam',
    linkedLabel: 'Застревание',
  },
  {
    id: 'safety',
    title: 'Безопасность',
    evidence: 'Emergency stop замораживает линию до Reset.',
    status: 'demo',
    linkedScenario: 'emergency_stop',
    linkedLabel: 'Аварийная остановка',
  },
  {
    id: 'reproducibility',
    title: 'Воспроизводимость',
    evidence: 'Сценарии, тесты и docs позволяют повторить демо жюри.',
    status: 'covered',
    linkedScenario: 'low_confidence',
    linkedLabel: 'Низкая уверенность CV',
  },
];

interface Props {
  onLinkedScenario?: (id: ScenarioId) => void;
}

export default function CriteriaCards({ onLinkedScenario }: Props) {
  return (
    <section className="criteria-cards-section" id="criteria" aria-labelledby="criteria-title">
      <div className="section-header">
        <h2 id="criteria-title">Критерии OZON</h2>
        <p>Каждый критерий хакатона закрыт сценарием, симуляцией и тестами.</p>
      </div>

      <div className="criteria-grid">
        {PRODUCT_CRITERIA.map((criterion) => (
          <article key={criterion.id} className="criteria-card">
            <div className="criteria-card-header">
              <h3>{criterion.title}</h3>
              <span className={`status-badge status-${criterion.status}`}>
                {criterion.status === 'covered' ? 'Covered' : 'Demo'}
              </span>
            </div>
            <p className="criteria-evidence">{criterion.evidence}</p>
            <div className="criteria-footer">
              <span>Сценарий:</span>
              {onLinkedScenario ? (
                <button
                  type="button"
                  className="criteria-link"
                  onClick={() => onLinkedScenario(criterion.linkedScenario)}
                >
                  {criterion.linkedLabel}
                </button>
              ) : (
                <strong>{criterion.linkedLabel}</strong>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
