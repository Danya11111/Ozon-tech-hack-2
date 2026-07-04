import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import CurrentProofCard from './CurrentProofCard';
import ThreeFallback from './ThreeD/ThreeFallback';
import { prefer3DByDefault, useWebGLSupport } from './ThreeD/useWebGL';
import type { SimulationState } from '../domain/types';

const SorterDigitalTwin = lazy(() => import('./ThreeD/SorterDigitalTwin'));

type ViewMode = '3d' | '2d';

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
  const webgl = useWebGLSupport();
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setViewMode(prefer3DByDefault(width, webgl && !contextLost) ? '3d' : '2d');
  }, [webgl, width, contextLost]);

  const item = simulation.currentItem;
  const category = item?.classification.category;
  const command = simulation.machineState.startsWith('ROUTE_TO_')
    ? simulation.machineState
    : item?.classification
      ? `ROUTE_TO_${item.classification.category}`
      : '—';

  const fallbackReason = useMemo(() => {
    if (!webgl || contextLost) return 'webgl' as const;
    if (width < 640) return 'mobile' as const;
    return 'user' as const;
  }, [webgl, contextLost, width]);

  const show3D = viewMode === '3d' && webgl && !contextLost;
  const simplified = width < 900;

  return (
    <section className="product-demo-section" id="demo" aria-labelledby="demo-title">
      <div className="demo-header">
        <div>
          <p className="section-eyebrow">Live product demo</p>
          <h2 id="demo-title">Главное демо</h2>
          <p className="demo-lead">
            3D digital twin показывает физическую маршрутизацию: A → конвейер → CV → накопитель → gate → B/C/D.
            Справа — товар, категория, причина и команда ROUTE_TO_*.
          </p>
        </div>
        <div className="demo-status">
          <span>Шаг:</span>
          <strong>{demoStepTitle}</strong>
          <span className={`status-dot ${simulation.systemStatus.toLowerCase()}`} aria-hidden="true" />
          <span className="demo-status-text">{simulation.systemStatus}</span>
        </div>
      </div>

      <div className="view-mode-toggle" role="group" aria-label="Режим сцены">
        <button
          type="button"
          className={show3D ? 'btn-primary' : 'btn-secondary'}
          onClick={() => {
            setContextLost(false);
            setViewMode('3d');
          }}
          disabled={!webgl}
        >
          3D Digital Twin
        </button>
        <button
          type="button"
          className={!show3D ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setViewMode('2d')}
        >
          2D fallback
        </button>
      </div>

      <div className="demo-layout">
        <div className="demo-scene-column">
          <p className="demo-mobile-hint">
            Товар проходит камеру, накопитель и gate, затем уходит в зону B, C или D.
          </p>
          <div className="demo-scene-container demo-scene-3d">
            {show3D ? (
              <Suspense fallback={<div className="three-loading">Загрузка 3D digital twin…</div>}>
                <SorterDigitalTwin
                  simulation={simulation}
                  simplified={simplified}
                  onContextLost={() => {
                    setContextLost(true);
                    setViewMode('2d');
                  }}
                />
              </Suspense>
            ) : (
              <ThreeFallback simulation={simulation} reason={fallbackReason} />
            )}
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
