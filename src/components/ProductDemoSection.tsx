import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import CurrentProofCard from './CurrentProofCard';
import ThreeFallback from './ThreeD/ThreeFallback';
import ThreeErrorBoundary from './ThreeD/ThreeErrorBoundary';
import { prefer3DByDefault, useWebGLSupport } from './ThreeD/useWebGL';
import type { SimulationState } from '../domain/types';
import type { DemoDirectorState } from '../domain/demoDirector';
import type { ContinuousPlaybackState } from '../domain/continuousPlayback';

// Stage 2B §7/§20: /details reuses the SAME CAD-derived machine assembly and
// live playback as the main page — no second procedural conveyor.
const SorterDigitalTwinContinuous = lazy(() => import('./ThreeD/SorterDigitalTwinContinuous'));

type ViewMode = '3d' | '2d';

interface Props {
  playback: ContinuousPlaybackState;
  simulation: SimulationState;
  demoStepTitle: string;
  demoDirector: DemoDirectorState;
  onStartDemo: () => void;
  onNext: () => void;
  onReset: () => void;
  onOpenEngineering: () => void;
  onStartAutoDemo: () => void;
  onToggleAutoDemo: () => void;
  onStopAutoDemo: () => void;
}

export default function ProductDemoSection({
  playback,
  simulation,
  demoStepTitle,
  demoDirector,
  onStartDemo,
  onNext,
  onReset,
  onOpenEngineering,
  onStartAutoDemo,
  onToggleAutoDemo,
  onStopAutoDemo,
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
              <ThreeErrorBoundary
                onError={(error) => {
                  console.error('3D Canvas failed:', error);
                  setContextLost(true);
                  setViewMode('2d');
                }}
                onUse2D={() => {
                  setContextLost(true);
                  setViewMode('2d');
                }}
              >
                <Suspense fallback={<div className="three-loading">Загрузка 3D digital twin…</div>}>
                  <SorterDigitalTwinContinuous
                    playback={playback}
                    simplified={simplified}
                    autoCameraEnabled
                    onContextLost={() => {
                      setContextLost(true);
                      setViewMode('2d');
                    }}
                  />
                </Suspense>
              </ThreeErrorBoundary>
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
              <span>Dimensions</span>
              <strong className={item?.classification.dimensionsPass === false ? 'fail-text' : 'pass-text'}>
                {item ? (item.classification.dimensionsPass ? 'PASS' : 'FAIL') : '—'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Roundness K</span>
              <strong>{item ? item.item.roundness.toFixed(2) : '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Category</span>
              <strong className={category ? `category-${category}` : ''}>{category ?? '—'}</strong>
            </div>
            <div className="summary-item">
              <span>Command</span>
              <strong>{command}</strong>
            </div>
            <div className="summary-item">
              <span>Target zone</span>
              <strong>{category ? `Zone ${category}` : '—'}</strong>
            </div>
          </div>

          <div className="demo-controls">
            {/* Auto Demo Controls */}
            {!demoDirector.isAutoDemoRunning ? (
              <button type="button" className="btn-primary" onClick={onStartAutoDemo}>
                🎬 Запустить автодемо
              </button>
            ) : (
              <>
                <button type="button" className="btn-primary" onClick={onToggleAutoDemo}>
                  {demoDirector.paused ? '▶ Продолжить' : '⏸ Пауза'}
                </button>
                <button type="button" className="btn-secondary" onClick={onStopAutoDemo}>
                  ⏹ Остановить
                </button>
              </>
            )}
            
            {/* Manual Controls (secondary when auto demo not running) */}
            {!demoDirector.isAutoDemoRunning && (
              <>
                <button type="button" className="btn-secondary" onClick={onStartDemo}>
                  Start demo (manual)
                </button>
                <button type="button" className="btn-secondary" onClick={onNext}>
                  Next step
                </button>
              </>
            )}
            
            <button type="button" className="btn-secondary" onClick={onReset}>
              Reset
            </button>
            <button type="button" className="btn-secondary" onClick={onOpenEngineering}>
              Engineering details
            </button>
          </div>
          
          {/* Auto Demo Status */}
          {demoDirector.isAutoDemoRunning && (
            <div className="auto-demo-status">
              <span>Auto Demo: </span>
              <strong>{demoDirector.currentStep.replace(/_/g, ' ')}</strong>
              <span> ({demoDirector.paused ? 'Paused' : 'Running'})</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
