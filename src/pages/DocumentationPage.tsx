import AppNav from '../components/AppNav';
import {
  CONFIRMED_COMPONENT_POLICY,
  CONFIRMED_LAYOUT,
  CURRENT_BLOCKERS,
  DATA_ACQUISITION_SEQUENCE,
  GATE_STATUS_BOARD,
  OWNER_INPUT_FORM_NOTE,
  PRODUCTION_STATUS,
  ROLLER_DIAMETER_CONFLICT,
} from '../data/productionStatusSummary';

const SECTIONS = [
  { id: 'about', title: '1. О проекте' },
  { id: 'simulation', title: '2. Веб-симуляция' },
  { id: 'production-goal', title: '3. Производственная цель' },
  { id: 'architecture', title: '4. Архитектура системы' },
  { id: 'author-cad', title: '5. Авторский CAD' },
  { id: 'diverter', title: '6. Производственный diverter' },
  { id: 'electronics', title: '7. Электроника и BOM' },
  { id: 'sensors', title: '8. Датчики' },
  { id: 'motor-encoder', title: '9. Двигатель и энкодер' },
  { id: 'production-inputs', title: '10. Производственные исходные данные' },
  { id: 'blockers', title: '11. Текущие блокеры' },
  { id: 'measurement-pack', title: '12. Пакет обмеров' },
  { id: 'gates', title: '13. Статусы Gate' },
  { id: 'limits', title: '14. Ограничения и допущения' },
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
            <p className="docs-subtitle">OZON Tech Sorter — проектная и инженерная сводка</p>
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
            <div className="docs-status-label">Текущий производственный статус</div>
            <div className="docs-status-value">{PRODUCTION_STATUS.acquisitionPackStatus}</div>
            <p className="docs-status-note">
              Пакет сбора данных готов. Это не означает готовность production design, выбор двигателя,
              энкодера, утверждение diverter или готовность CAD.
            </p>
          </section>

          <section id="about" className="docs-section">
            <h2>{SECTIONS[0].title}</h2>
            <p>
              Проект — цифровой двойник и инженерный контур линии сортировки Ozon Tech Sorter:
              конвейер, классификация товаров по категориям B/C/D, stop-gate и будущий производственный
              diverter. Веб-интерфейс показывает непрерывную симуляцию; производственный CAD diverter
              пока не создан.
            </p>
          </section>

          <section id="simulation" className="docs-section">
            <h2>{SECTIONS[1].title}</h2>
            <p>
              Главная страница <code>/</code> — действующая веб-симуляция: CAD-конвейер, товары, движение,
              классификация, маршруты B/C/D, камеры и элементы управления. Runtime опирается на
              подтверждённую геометрию twin и не заменяет физический обмер линии.
            </p>
          </section>

          <section id="production-goal" className="docs-section">
            <h2>{SECTIONS[2].title}</h2>
            <p>
              Цель — промышленная линия в рабочей зоне{' '}
              <strong>
                {CONFIRMED_LAYOUT.workspaceMm.length} × {CONFIRMED_LAYOUT.workspaceMm.width} мм
              </strong>
              , конвейер шириной {CONFIRMED_LAYOUT.conveyorWidthMm} мм и высотой верха ленты{' '}
              {CONFIRMED_LAYOUT.conveyorHeightMm} мм. Web digital twin должен в дальнейшем
              генерироваться из production CAD, а не из неподтверждённых допущений.
            </p>
          </section>

          <section id="architecture" className="docs-section">
            <h2>{SECTIONS[3].title}</h2>
            <ul>
              <li>Источник геометрии конвейера — авторский CAD / замороженный GLB twin.</li>
              <li>Классификация и маршрутизация — domain-логика симуляции (не меняется этой UI-задачей).</li>
              <li>Link027 / Link029 — роль <strong>{CONFIRMED_LAYOUT.link027029Role}</strong>, не diverter.</li>
              <li>Авторский CAD diverter: <strong>{CONFIRMED_LAYOUT.authorDiverter}</strong>.</li>
              <li>
                Последовательность данных: {DATA_ACQUISITION_SEQUENCE.join(' → ')}.
              </li>
            </ul>
          </section>

          <section id="author-cad" className="docs-section">
            <h2>{SECTIONS[4].title}</h2>
            <p>
              Авторский файл конвейера <code>3d_models/conveer.FCStd</code> и runtime GLB{' '}
              <code>public/models/sorter/conveyor-clean.glb</code> заморожены по checksum. Изменения
              байтов этих файлов в рамках UI-задачи запрещены. Point A по чертежу: центр линии на
              {` ${CONFIRMED_LAYOUT.pointACenterlineFromWorkspaceBottomMm} мм`} от низа рабочей зоны;
              Point A X, junction и ROOT_BIND требуют физического подтверждения.
            </p>
          </section>

          <section id="diverter" className="docs-section">
            <h2>{SECTIONS[5].title}</h2>
            <p>
              Производственный CAD diverter создавать нельзя, пока не заполнены обмеры и не сняты
              геометрические блокеры. Линейный angled pusher отклонён; rotary swing-arm остаётся
              кандидатом и не утверждён. Архитектура diverter на этой странице не выбирается.
            </p>
          </section>

          <section id="electronics" className="docs-section">
            <h2>{SECTIONS[6].title}</h2>
            <p>
              Gate 2C (production electrical): статус{' '}
              <code>{PRODUCTION_STATUS.electricalGateStatus}</code>. В текущем BOM нет принятых
              production-компонентов; прототипные позиции (в т.ч. MG996R) не переносятся в production
              без замены. Силовая архитектура и шкаф требуют измерений и решений владельца.
            </p>
          </section>

          <section id="sensors" className="docs-section">
            <h2>{SECTIONS[7].title}</h2>
            <p>
              VL53L0X: <strong>{CONFIRMED_COMPONENT_POLICY.vl53l0x}</strong> — не использовать как
              производственный или safety-датчик. Производственная сенсорика не зафиксирована.
            </p>
          </section>

          <section id="motor-encoder" className="docs-section">
            <h2>{SECTIONS[8].title}</h2>
            <ul>
              <li>Двигатель / редуктор / драйвер: {CONFIRMED_COMPONENT_POLICY.productionMotor}.</li>
              <li>Энкодер: {CONFIRMED_COMPONENT_POLICY.productionEncoder} (BLOCKED_BY_MOTOR_SPEC).</li>
              <li>MG996R: {CONFIRMED_COMPONENT_POLICY.mg996r}.</li>
            </ul>
            <p>
              Выбор коммерческой модели двигателя или энкодера на этой странице не выполняется —
              сначала заполняется форма идентификации двигателя из пакета обмеров.
            </p>
          </section>

          <section id="production-inputs" className="docs-section">
            <h2>{SECTIONS[9].title}</h2>
            <p>{OWNER_INPUT_FORM_NOTE}</p>
            <p>
              Подтверждённые размеры рабочей зоны и конвейера см. выше. Неподтверждённые величины
              (диаметры роликов после обмера, массы SKU, токи, safety PL/SIL) не выдаются за факты.
            </p>
            <div className="docs-conflict" data-testid="docs-roller-conflict">
              <strong>Конфликт диаметров роликов</strong>
              <ul>
                <li>Author CAD idler: {ROLLER_DIAMETER_CONFLICT.authorCadIdlerMm} мм</li>
                <li>Runtime idler: {ROLLER_DIAMETER_CONFLICT.runtimeIdlerMm} мм</li>
                <li>Runtime drive: {ROLLER_DIAMETER_CONFLICT.runtimeDriveMm} мм</li>
              </ul>
              <p>Статус: {ROLLER_DIAMETER_CONFLICT.status} — требуется физический обмер.</p>
            </div>
          </section>

          <section id="blockers" className="docs-section" data-testid="docs-blockers">
            <h2>{SECTIONS[10].title}</h2>
            <ul className="docs-blocker-list">
              {CURRENT_BLOCKERS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>

          <section id="measurement-pack" className="docs-section">
            <h2>{SECTIONS[11].title}</h2>
            <p>
              Gate 2D подготовил пакет: протокол обмеров, контрольные точки P0–P12, shot list фото,
              формы двигателя / энкодера / SKU / скорости / throughput / power / safety и главный{' '}
              <code>OWNER_PRODUCTION_INPUT_FORM</code>. Статус пакета:{' '}
              <strong>{PRODUCTION_STATUS.acquisitionPackStatus}</strong>.
            </p>
            <p>
              Артефакты пакета хранятся вне публичного runtime (ignored path) и не подключаются из
              браузера напрямую.
            </p>
          </section>

          <section id="gates" className="docs-section" data-testid="docs-gates">
            <h2>{SECTIONS[12].title}</h2>
            <div className="docs-table-scroll" data-testid="docs-table-scroll">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Gate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {GATE_STATUS_BOARD.map((row) => (
                    <tr key={row.gate}>
                      <td>{row.gate}</td>
                      <td>
                        <code>{row.status}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="limits" className="docs-section">
            <h2>{SECTIONS[13].title}</h2>
            <ul>
              <li>Неутверждённые значения runtime не считаются production truth.</li>
              <li>MG996R и VL53L0X не являются production/safety решениями.</li>
              <li>Production CAD diverter и Gate 3 не начаты.</li>
              <li>Расчёты на неподтверждённых диаметрах роликов / ROOT_BIND запрещены.</li>
              <li>Эта страница — сводка; она не заменяет заполненный owner measurement pack.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
