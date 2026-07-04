import SorterScene from './SorterScene';
import CurrentProofCard from './CurrentProofCard';
import type { SimulationState } from '../domain/types';

interface Props {
  simulation: SimulationState;
  demoStepTitle: string;
  onStartDemo: () => void;
  onNext: () => void;
  onReset: () => void;
  onOpenEngineering: () => void;
}

export default function ProductDemoSection({
  simulation,
  demoStepTitle,
  onStartDemo,
  onNext,
  onReset,
  onOpenEngineering,
}: Props) {
  const item = simulation.currentItem;
  const category = item?.classification.category;
  const command = simulation.machineState.startsWith('ROUTE_TO_')
    ? simulation.machineState
    : item?.classification
      ? `ROUTE_TO_${item.classification.category}`
      : '—';

  return (
    <section className="product-demo-section" id="demo" aria-labelledby="demo-title">
      <div className="demo-header">
        <div>
          <p className="section-eyebrow">Live product demo</p>
          <h2 id="demo-title">Главное демо</h2>
          <p className="demo-lead">
            Слева — упрощённая сцена конвейера. Справа — товар, категория, причина решения и команда маршрутизации.
          </p>
        </div>
        <div className="demo-status">
          <span>Шаг:</span>
          <strong>{demoStepTitle}</strong>
          <span className={`status-dot ${simulation.systemStatus.toLowerCase()}`} aria-hidden="true" />
          <span className="demo-status-text">{simulation.systemStatus}</span>
        </div>
      </div>

      <div className="demo-layout">
        <div className="demo-scene-column">
          <p className="demo-mobile-hint">
            Товар проходит камеру, классификатор и gate, затем уходит в зону B, C или D.
          </p>
          <div className="demo-scene-container">
            <SorterScene simulation={simulation} variant="simple" />
          </div>
        </div>

        <aside className="demo-result-column" aria-label="Результат классификации">
          <CurrentProofCard simulation={simulation} />

          <div className="demo-result-summary">
            <div className="summary-item">
              <span>Товар</span>
              <strong>{item?.item.name ?? 'Ожидание'}</strong>
            </div>
            <div className="summary-item">
              <span>Категория</span>
              <strong className={category ? `category-${category}` : ''}>{category ?? '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Команда</span>
              <strong>{command}</strong>
            </div>
            <div className="summary-item">
              <span>Зона</span>
              <strong>{category ? `Зона ${category}` : '—'}</strong>
            </div>
          </div>

          <div className="demo-controls">
            <button type="button" className="btn-primary" onClick={onStartDemo}>
              Start demo
            </button>
            <button type="button" className="btn-primary" onClick={onNext}>
              Next step
            </button>
            <button type="button" className="btn-secondary" onClick={onReset}>
              Reset
            </button>
            <button type="button" className="btn-secondary" onClick={onOpenEngineering}>
              Engineering details
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
