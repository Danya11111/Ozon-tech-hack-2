import { OFFICIAL_RULE_LABELS } from '../domain/classifier';

interface HeroSectionProps {
  onStartDemo: () => void;
  onShowScenarios: () => void;
  onOpenEngineering: () => void;
}

export default function HeroSection({
  onStartDemo,
  onShowScenarios,
  onOpenEngineering,
}: HeroSectionProps) {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-content">
        <p className="hero-eyebrow">OZON Tech · Product Demo</p>
        <h1 id="hero-title" className="hero-title">
          Интеллектуальная система предварительной сортировки товаров
        </h1>
        <p className="hero-subtitle">
          Цифровой стенд показывает полный цикл: тестовые измерения → rule-based классификация B/C/D → команда ROUTE_TO_* → маршрутизация в digital twin.
        </p>

        <div className="hero-badges" aria-label="Параметры системы">
          <span className="hero-badge">Конвейер 1 м/с</span>
          <span className="hero-badge">{OFFICIAL_RULE_LABELS.minDisplay}</span>
          <span className="hero-badge">{OFFICIAL_RULE_LABELS.maxDisplay}</span>
          <span className="hero-badge">{OFFICIAL_RULE_LABELS.roundnessDisplay} → D</span>
          <span className="hero-badge">C priority</span>
        </div>

        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={onStartDemo}>
            Запустить демо
          </button>
          <button type="button" className="btn-secondary" onClick={onShowScenarios}>
            Показать сценарии
          </button>
          <button type="button" className="btn-secondary" onClick={onOpenEngineering}>
            Инженерный режим
          </button>
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="hero-chain">
          <div className="chain-step">
            <div className="chain-icon">1</div>
            <span>Detection</span>
          </div>
          <div className="chain-arrow" />
          <div className="chain-step">
            <div className="chain-icon">2</div>
            <span>Classification</span>
          </div>
          <div className="chain-arrow" />
          <div className="chain-step">
            <div className="chain-icon">3</div>
            <span>Command</span>
          </div>
          <div className="chain-arrow" />
          <div className="chain-step">
            <div className="chain-icon">4</div>
            <span>Routing</span>
          </div>
        </div>
        <p className="hero-chain-caption">
          Detection → Classification → ROUTE_TO_* → Actuator → B/C/D
        </p>
      </div>
    </section>
  );
}
