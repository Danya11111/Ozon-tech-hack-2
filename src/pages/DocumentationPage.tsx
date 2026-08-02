import AppNav from '../components/AppNav';
import {
  CAD_PROVENANCE,
  CLASSIFIER_BOUNDS,
  CONFIRMED_LAYOUT,
  CURRENT_LIMITATIONS,
  DIVERTER_KINEMATICS,
  OFFICIAL_SOURCE_MATRIX,
  PHYSICS_STATUS,
  PRODUCTION_STATUS,
  ROUTE_MAPPING,
  RUNTIME_FLOW,
  VALIDATION_BOARD,
} from '../data/productionStatusSummary';

const SECTIONS = [
  { id: 'about', title: '1. Цель проекта' },
  { id: 'runtime-flow', title: '2. Runtime flow' },
  { id: 'layout', title: '3. Активная линия' },
  { id: 'classifier', title: '4. Классификация' },
  { id: 'routes', title: '5. Маршруты B/C/D' },
  { id: 'diverter', title: '6. Diverter state machine' },
  { id: 'cad', title: '7. CAD provenance' },
  { id: 'physics', title: '8. Физика' },
  { id: 'validation', title: '9. Validation status' },
  { id: 'official', title: '10. Official-source matrix' },
  { id: 'limits', title: '11. Known limitations' },
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
            <div className="product-brand-title">Ozon Tech Sorter</div>
            <div className="product-brand-sub">Цифровой двойник линии сортировки</div>
          </div>
        </div>
        <AppNav variant="solid" />
        <div className="product-telemetry docs-topbar-meta">
          <div className="product-tele-item">
            <span className="product-tele-label">Раздел</span>
            <span className="product-tele-value">Документация</span>
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
            <p className="docs-subtitle">Текущее состояние веб-симуляции и инженерный статус</p>
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
            <div className="docs-status-value">{PRODUCTION_STATUS.acquisitionPackStatus}</div>
            <p className="docs-status-note">
              Web twin: {PRODUCTION_STATUS.webTwinStatus}. Unit tests {PRODUCTION_STATUS.unitTests},
              build {PRODUCTION_STATUS.productionBuild}. Contact physics:{' '}
              {PRODUCTION_STATUS.contactPhysics}. Official compliance:{' '}
              {PRODUCTION_STATUS.officialCompliance}.
            </p>
          </section>

          <section id="about" className="docs-section">
            <h2>{SECTIONS[0].title}</h2>
            <p>
              Цифровой двойник линии сортировки Ozon Tech: конвейер, камера/классификация, физическая
              маршрутизация и три приёмные категории (B / C / D). Страница <code>/</code> — рабочая
              веб-симуляция; эта страница — каноническая сводка текущего состояния. Реальный
              CV-прототип (RealSense D415) лежит в <code>cv/</code> и не подключён к live-сайту.
            </p>
          </section>

          <section id="runtime-flow" className="docs-section">
            <h2>{SECTIONS[1].title}</h2>
            <p>{RUNTIME_FLOW.join(' → ')}</p>
          </section>

          <section id="layout" className="docs-section">
            <h2>{SECTIONS[2].title}</h2>
            <ul>
              <li>
                Рабочая зона (чертёж): {CONFIRMED_LAYOUT.workspaceMm.length} ×{' '}
                {CONFIRMED_LAYOUT.workspaceMm.width} мм; лента {CONFIRMED_LAYOUT.conveyorWidthMm} мм /
                высота верха {CONFIRMED_LAYOUT.conveyorHeightMm} мм.
              </li>
              <li>Модули CAD: {CONFIRMED_LAYOUT.modules.join(', ')}.</li>
              <li>Приёмники: {CONFIRMED_LAYOUT.receivers.join(', ')}.</li>
            </ul>
          </section>

          <section id="classifier" className="docs-section">
            <h2>{SECTIONS[3].title}</h2>
            <p>
              Status: <code>{CLASSIFIER_BOUNDS.status}</code>
            </p>
            <ul>
              <li>Min: {CLASSIFIER_BOUNDS.display.min}</li>
              <li>Max: {CLASSIFIER_BOUNDS.display.max}</li>
              <li>Roundness: {CLASSIFIER_BOUNDS.display.roundness}</li>
              <li>Order: {CLASSIFIER_BOUNDS.checkOrder}</li>
            </ul>
            <p>
              OFFICIAL_SOURCE_REFERENCE: <code>{CLASSIFIER_BOUNDS.officialSourceReference}</code>
              {CLASSIFIER_BOUNDS.officialSourceParsedThisPass
                ? ''
                : ' — PDF not re-parsed in this documentation pass; bounds match current code/tests.'}
            </p>
          </section>

          <section id="routes" className="docs-section">
            <h2>{SECTIONS[4].title}</h2>
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

          <section id="diverter" className="docs-section">
            <h2>{SECTIONS[5].title}</h2>
            <p>{DIVERTER_KINEMATICS.phases.join(' → ')}</p>
            <ul>
              <li>Rotation duration: {DIVERTER_KINEMATICS.rotationDurationSec.toFixed(2)} s</li>
              <li>Safety margin: {DIVERTER_KINEMATICS.openingSafetyMarginSec.toFixed(2)} s</li>
              <li>Contact plane S: {DIVERTER_KINEMATICS.contactPlaneS}</li>
              <li>Clear plane S: {DIVERTER_KINEMATICS.clearPlaneS.toFixed(4)}</li>
              <li>Route command bound to productId; one active product at a time</li>
              <li>Close after rear-clear of clear plane</li>
              <li>
                Invented sorter drive mesh active:{' '}
                {DIVERTER_KINEMATICS.generatedMechanismActive ? 'YES' : 'NO'}
              </li>
            </ul>
          </section>

          <section id="cad" className="docs-section">
            <h2>{SECTIONS[6].title}</h2>
            <ul>
              <li>
                Author: <code>{CAD_PROVENANCE.authorFcstd}</code>
                <br />
                SHA-256: <code>{CAD_PROVENANCE.authorSha256}</code>
              </li>
              <li>
                Runtime: <code>{CAD_PROVENANCE.runtimeGlb}</code>
                <br />
                SHA-256: <code>{CAD_PROVENANCE.runtimeSha256}</code>
              </li>
              <li>Author servo/holder nodes used in sorter module only.</li>
              <li>Invented sorter drive mesh inactive; author CAD diverters only.</li>
              <li>Horn / transmission in GLB: {CAD_PROVENANCE.hornTransmissionInGlb}.</li>
            </ul>
          </section>

          <section id="physics" className="docs-section">
            <h2>{SECTIONS[7].title}</h2>
            <h3>IMPLEMENTED</h3>
            <ul>
              {PHYSICS_STATUS.implemented.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>NOT FULLY VALIDATED</h3>
            <ul>
              {PHYSICS_STATUS.notFullyValidated.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3>PLANNED</h3>
            <ul>
              {PHYSICS_STATUS.planned.map((x) => (
                <li key={x}>{x}</li>
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

          <section id="official" className="docs-section">
            <h2>{SECTIONS[9].title}</h2>
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

          <section id="limits" className="docs-section" data-testid="docs-blockers">
            <h2>{SECTIONS[10].title}</h2>
            <ul className="docs-blocker-list">
              {CURRENT_LIMITATIONS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
