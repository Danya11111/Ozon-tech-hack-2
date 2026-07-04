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
          Интеллектуальная система сортировки товаров
        </h1>
        <p className="hero-subtitle">
          Симуляция показывает полный цикл: обнаружение товара, классификация по правилам,
          управляющая команда и маршрутизация в зоны B/C/D.
        </p>

        <div className="hero-badges" aria-label="Ключевые возможности">
          <span className="hero-badge">Computer Vision</span>
          <span className="hero-badge">Rule-based classification</span>
          <span className="hero-badge">Actuator routing</span>
          <span className="hero-badge">Cycle time</span>
          <span className="hero-badge">Fault handling</span>
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
          Результат демо: категория B/C/D, команда ROUTE_TO_* и целевая зона
        </p>
      </div>
    </section>
  );
}
