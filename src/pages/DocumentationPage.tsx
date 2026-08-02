import AppNav from '../components/AppNav';
import {
  ARCHITECTURE,
  CAD_PROVENANCE,
  CLASSIFIER_BOUNDS,
  CONFIRMED_LAYOUT,
  CURRENT_LIMITATIONS,
  CV_PROTOTYPE,
  DIVERTER_KINEMATICS,
  MOBILE_BEHAVIOR,
  OFFICIAL_SOURCE_MATRIX,
  PHYSICAL_STAND,
  PHYSICS_STATUS,
  PRODUCTION_STATUS,
  REPOSITORY_LAYOUT,
  ROUTE_MAPPING,
  RUNTIME_FLOW,
  SOLUTION_COMPONENTS,
  VALIDATION_BOARD,
} from '../data/productionStatusSummary';

const SECTIONS = [
  { id: 'about', title: '1. Обзор проекта' },
  { id: 'production-web', title: '2. Production web' },
  { id: 'cv', title: '3. Real CV prototype' },
  { id: 'classifier', title: '4. Официальная классификация' },
  { id: 'stand', title: '5. Физический стенд' },
  { id: 'twin', title: '6. Digital twin' },
  { id: 'architecture', title: '7. Архитектура' },
  { id: 'repository', title: '8. Репозиторий' },
  { id: 'validation', title: '9. Validation' },
  { id: 'limits', title: '10. Ограничения' },
  { id: 'routes', title: '11. Маршруты B/C/D' },
  { id: 'official', title: '12. Official sources' },
] as const;

function TocList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ol>
      {SECTIONS.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            onClick={() => {
              onNavigate?.();
            }}
          >
            {s.title.replace(/^\d+\.\s*/, '')}
          </a>
        </li>
      ))}
    </ol>
  );
}

export default function DocumentationPage() {
  return (
    <div className="docs-page" data-testid="documentation-page">
      <header className="product-topbar docs-product-topbar" data-testid="product-topbar">
        <div className="product-brand">
          <span className="product-brand-mark" aria-hidden="true">
            O
          </span>
          <div className="product-brand-text">
            <div className="product-brand-title">OWL PRIME</div>
            <div className="product-brand-sub">Ozon Tech Track 3 — документация</div>
          </div>
        </div>
        <AppNav variant="solid" />
        <div className="product-telemetry docs-topbar-meta">
          <div className="product-tele-item">
            <span className="product-tele-label">Ветка</span>
            <span className="product-tele-value">{PRODUCTION_STATUS.canonicalBranch}</span>
          </div>
        </div>
      </header>

      <header className="docs-header docs-header-narrow">
        <div className="docs-brand">
          <span className="docs-brand-mark" aria-hidden="true">
            O
          </span>
          <div>
            <h1 className="docs-title">Документация</h1>
            <p className="docs-subtitle">Финальный инженерный статус решения OWL PRIME</p>
          </div>
        </div>
        <AppNav variant="solid" />
      </header>

      <div className="docs-layout">
        <aside className="docs-toc docs-toc-desktop" aria-label="Содержание" data-testid="docs-toc-desktop">
          <TocList />
        </aside>

        <details className="docs-toc-mobile" data-testid="docs-toc-mobile">
          <summary>Содержание</summary>
          <TocList
            onNavigate={() => {
              const el = document.querySelector('.docs-toc-mobile') as HTMLDetailsElement | null;
              if (el) el.open = false;
            }}
          />
        </details>

        <main className="docs-main">
          <section className="docs-status-banner" data-testid="docs-production-status">
            <div className="docs-status-label">Текущий статус</div>
            <div className="docs-status-value">{PRODUCTION_STATUS.projectStatus}</div>
            <p className="docs-status-note">
              Web: {PRODUCTION_STATUS.webTwinStatus}. CV: {PRODUCTION_STATUS.cvStatus} (live
              integrated: {PRODUCTION_STATUS.cvLiveIntegrated ? 'YES' : 'NO'}). Unit tests{' '}
              {PRODUCTION_STATUS.unitTests}, CV tests {PRODUCTION_STATUS.cvTests}, build{' '}
              {PRODUCTION_STATUS.productionBuild}. Domain: {PRODUCTION_STATUS.productionUrl}. Contact
              physics: {PRODUCTION_STATUS.contactPhysics}.
            </p>
          </section>

          <section id="about" className="docs-section">
            <h2>{SECTIONS[0].title}</h2>
            <p>
              OWL PRIME — инженерный прототип предварительной сортировки товаров для Ozon Tech Track
              3: веб-цифровой двойник, реальный CV-прототип, физический экспериментальный стенд,
              авторский CAD и единые правила классификации B/C/D.
            </p>
            <ul>
              {SOLUTION_COMPONENTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section id="production-web" className="docs-section">
            <h2>{SECTIONS[1].title}</h2>
            <p>
              Production: <a href={PRODUCTION_STATUS.productionUrl}>{PRODUCTION_STATUS.productionUrl}</a>
            </p>
            <ul>
              <li>
                <code>/</code> — непрерывная симуляция конвейера
              </li>
              <li>
                <code>/documentation</code> — эта инженерная документация
              </li>
            </ul>
            <p>
              На desktop — интерактивный WebGL 3D twin: CAD-конвейер, цифровое измерение,
              классификация B/C/D, CAD-дивертеры и физика Rapier. Mobile: {MOBILE_BEHAVIOR.mobile}.
            </p>
            <ul>
              <li>
                Рабочая зона: {CONFIRMED_LAYOUT.workspaceMm.length} × {CONFIRMED_LAYOUT.workspaceMm.width}{' '}
                мм; лента {CONFIRMED_LAYOUT.conveyorWidthMm} мм / высота{' '}
                {CONFIRMED_LAYOUT.conveyorHeightMm} мм.
              </li>
              <li>Модули: {CONFIRMED_LAYOUT.modules.join(', ')}.</li>
              <li>Приёмники: {CONFIRMED_LAYOUT.receivers.join(', ')}.</li>
              <li>Runtime flow: {RUNTIME_FLOW.join(' → ')}</li>
            </ul>
          </section>

          <section id="cv" className="docs-section">
            <h2>{SECTIONS[2].title}</h2>
            <p>
              Path: <code>{CV_PROTOTYPE.path}</code>. Status:{' '}
              <code>{CV_PROTOTYPE.status}</code>. Hardware: {CV_PROTOTYPE.hardware}. Software:{' '}
              {CV_PROTOTYPE.software}.
            </p>
            <p>Pipeline: {CV_PROTOTYPE.pipeline.join(' → ')}</p>
            <ul>
              {CV_PROTOTYPE.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>

          <section id="classifier" className="docs-section">
            <h2>{SECTIONS[3].title}</h2>
            <p>
              Status: <code>{CLASSIFIER_BOUNDS.status}</code>. Source:{' '}
              <code>{CLASSIFIER_BOUNDS.officialSourceReference}</code>.
            </p>
            <ul>
              <li>Min: {CLASSIFIER_BOUNDS.display.min}</li>
              <li>Max: {CLASSIFIER_BOUNDS.display.max}</li>
              <li>Roundness: {CLASSIFIER_BOUNDS.display.roundness}</li>
              <li>
                Boundary: <strong>{CLASSIFIER_BOUNDS.display.exactBoundary}</strong>
              </li>
              <li>Order: {CLASSIFIER_BOUNDS.checkOrder}</li>
              <li>Oversized circular product still goes to C (C priority).</li>
            </ul>
            <p>
              Web (<code>src/domain/classifier.ts</code>) and CV (<code>cv/classify.py</code>) both use
              strict <code>K &gt; 0.8</code>.
            </p>
          </section>

          <section id="stand" className="docs-section">
            <h2>{SECTIONS[4].title}</h2>
            <p>
              Status: <code>{PHYSICAL_STAND.status}</code>. {PHYSICAL_STAND.purpose}
            </p>
            <ul>
              {PHYSICAL_STAND.elements.map((el) => (
                <li key={el}>{el}</li>
              ))}
            </ul>
          </section>

          <section id="twin" className="docs-section">
            <h2>{SECTIONS[5].title}</h2>
            <ul>
              <li>
                Author CAD: <code>{CAD_PROVENANCE.authorFcstd}</code>
              </li>
              <li>
                Runtime conveyor: <code>{CAD_PROVENANCE.runtimeGlb}</code>
              </li>
              <li>Product STL models in <code>public/models/</code></li>
              <li>Same B/C/D classifier rules as CV</li>
              <li>Rapier physics + CAD diverters (−45° / +45°)</li>
              <li>Synchronized digital routing into B/C/D receivers</li>
            </ul>
            <h3>Physics</h3>
            <h4>IMPLEMENTED</h4>
            <ul>
              {PHYSICS_STATUS.implemented.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h4>NOT FULLY VALIDATED</h4>
            <ul>
              {PHYSICS_STATUS.notFullyValidated.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>
              Diverter phases: {DIVERTER_KINEMATICS.phases.join(' → ')} (
              {DIVERTER_KINEMATICS.rotationDurationSec.toFixed(2)} s rotation).
            </p>
          </section>

          <section id="architecture" className="docs-section">
            <h2>{SECTIONS[6].title}</h2>
            <h3>REAL PATH</h3>
            <p>{ARCHITECTURE.realPath.join(' → ')}</p>
            <h3>DIGITAL PATH</h3>
            <p>{ARCHITECTURE.digitalPath.join(' → ')}</p>
          </section>

          <section id="repository" className="docs-section">
            <h2>{SECTIONS[7].title}</h2>
            <p>
              Canonical branch: <code>{PRODUCTION_STATUS.canonicalBranch}</code>. Other branches are
              historical and not required to run the solution.
            </p>
            <ul>
              {REPOSITORY_LAYOUT.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section id="validation" className="docs-section" data-testid="docs-gates">
            <h2>{SECTIONS[8].title}</h2>
            <div className="docs-table-scroll" data-testid="docs-table-scroll">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Check</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {VALIDATION_BOARD.map((row) => (
                    <tr key={row.item}>
                      <td>{row.item}</td>
                      <td>
                        <code>{row.status}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="limits" className="docs-section" data-testid="docs-blockers">
            <h2>{SECTIONS[9].title}</h2>
            <ul className="docs-blocker-list">
              {CURRENT_LIMITATIONS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>

          <section id="routes" className="docs-section">
            <h2>{SECTIONS[10].title}</h2>
            <div className="docs-table-scroll">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Physical route</th>
                    <th>CAD diverter</th>
                    <th>Angle</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTE_MAPPING.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>
                        <code>{row.physicalRoute}</code>
                      </td>
                      <td>{row.activeDiverter}</td>
                      <td>{row.signedAngleDeg}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="official" className="docs-section">
            <h2>{SECTIONS[11].title}</h2>
            <div className="docs-table-scroll">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>SOURCE</th>
                    <th>PURPOSE</th>
                    <th>PRESENT</th>
                    <th>CANONICAL</th>
                    <th>USAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFICIAL_SOURCE_MATRIX.map((row) => (
                    <tr key={row.source}>
                      <td>
                        <code>{row.source}</code>
                      </td>
                      <td>{row.purpose}</td>
                      <td>{row.present ? 'YES' : 'NO'}</td>
                      <td>{row.canonical ? 'YES' : 'NO'}</td>
                      <td>{row.usage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
