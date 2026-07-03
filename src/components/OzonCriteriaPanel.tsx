import { useMemo, useState } from 'react';
import { OZON_CRITERIA } from '../data/criteria';
import type { CriteriaStatus, DemoStep } from '../domain/types';

type CriteriaFilter = 'all' | CriteriaStatus;

const filters: CriteriaFilter[] = ['all', 'covered', 'partially covered', 'demo step available'];

export default function OzonCriteriaPanel({ currentStep }: { currentStep: DemoStep }) {
  const [filter, setFilter] = useState<CriteriaFilter>('all');
  const visibleCriteria = useMemo(
    () => OZON_CRITERIA.filter((criterion) => filter === 'all' || criterion.status === filter),
    [filter],
  );
  const related = new Set(currentStep.relatedCriteria);

  return (
    <section className="panel criteria-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OZON criteria coverage</p>
          <h2>Evidence checklist</h2>
        </div>
        <span className="criteria-count">{visibleCriteria.length}/{OZON_CRITERIA.length}</span>
      </div>
      <div className="criteria-filters">
        {filters.map((item) => (
          <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <div className="criteria-list">
        {visibleCriteria.map((criterion) => (
          <article key={criterion.id} className={related.has(criterion.id) ? 'criterion-card related' : 'criterion-card'}>
            <div>
              <strong>{criterion.title}</strong>
              <span className={`criterion-status status-${criterion.status.replaceAll(' ', '-')}`}>{criterion.status}</span>
            </div>
            <p>{criterion.evidence}</p>
            <em>{criterion.relatedScenarioIds.join(', ')} / {criterion.relatedDoc}</em>
          </article>
        ))}
      </div>
    </section>
  );
}
