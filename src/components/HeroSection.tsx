export default function HeroSection({ onStartDemo }: { onStartDemo: () => void }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <h1 className="hero-title">Интеллектуальная система сортировки товаров</h1>
        <p className="hero-subtitle">
          Симуляция показывает полный цикл: обнаружение товара, классификация по правилам, 
          управляющая команда и маршрутизация в зоны B, C, D.
        </p>
        
        <div className="hero-badges">
          <span className="hero-badge">Computer Vision</span>
          <span className="hero-badge">Rule-based classification</span>
          <span className="hero-badge">Actuator routing</span>
          <span className="hero-badge">Cycle time</span>
          <span className="hero-badge">Fault handling</span>
        </div>

        <div className="hero-actions">
          <button className="btn-primary" onClick={onStartDemo}>Запустить демо</button>
          <a href="#scenarios" className="btn-secondary">Показать сценарии</a>
          <a href="#engineering" className="btn-secondary">Инженерный режим</a>
        </div>
      </div>
      
      <div className="hero-visual">
        <div className="hero-chain">
          <div className="chain-step">
            <div className="chain-icon">📷</div>
            <span>Detection</span>
          </div>
          <div className="chain-arrow">→</div>
          <div className="chain-step">
            <div className="chain-icon">🧠</div>
            <span>Classification</span>
          </div>
          <div className="chain-arrow">→</div>
          <div className="chain-step">
            <div className="chain-icon">⚡</div>
            <span>Command</span>
          </div>
          <div className="chain-arrow">→</div>
          <div className="chain-step">
            <div className="chain-icon">📦</div>
            <span>Routing</span>
          </div>
        </div>
      </div>
    </section>
  );
}
