import type { SimulationState } from '../domain/types';

interface HeaderProps {
  simulation: SimulationState;
  onReset: () => void;
  onOpenDemo: () => void;
  onOpenScenarios: () => void;
  onOpenEngineering: () => void;
}

export default function Header({
  simulation,
  onReset,
  onOpenDemo,
  onOpenScenarios,
  onOpenEngineering,
}: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-logo">
        <span className="logo-icon" aria-hidden="true">
          O
        </span>
        <div className="logo-text">
          <span className="logo-title">OZON Tech Sorter</span>
          <span className="logo-subtitle">Product Demo</span>
        </div>
      </div>

      <nav className="header-nav" aria-label="Основная навигация">
        <button type="button" className="nav-link" onClick={onOpenDemo}>
          Демо
        </button>
        <button type="button" className="nav-link" onClick={onOpenScenarios}>
          Сценарии
        </button>
        <button type="button" className="nav-link" onClick={onOpenEngineering}>
          Инженерный режим
        </button>
        <button type="button" className="nav-link nav-reset" onClick={onReset}>
          Reset
        </button>
      </nav>

      <div className="header-status-compact" aria-live="polite">
        <span className={`status-dot ${simulation.systemStatus.toLowerCase()}`} aria-hidden="true" />
        <span>{simulation.systemStatus}</span>
      </div>
    </header>
  );
}
