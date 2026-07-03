import { OZON_CRITERIA } from '../data/criteria';

export default function CriteriaCards() {
  return (
    <section className="criteria-cards-section" id="criteria">
      <div className="section-header">
        <h2>Покрытие критериев OZON</h2>
        <p>Каждый инженерный критерий хакатона покрывается симуляцией и тестами.</p>
      </div>
      
      <div className="criteria-grid">
        {OZON_CRITERIA.map((criterion) => (
          <div key={criterion.id} className="criteria-card">
            <div className="criteria-card-header">
              <h3>{criterion.title}</h3>
              <span className={`status-badge ${criterion.status.replace(/ /g, '-')}`}>
                {criterion.status}
              </span>
            </div>
            <p className="criteria-evidence">{criterion.evidence}</p>
            <div className="criteria-footer">
              <span className="related-docs">Docs: {criterion.relatedDoc}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
