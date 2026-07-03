import type { SimulationState } from '../domain/types';

interface HeaderProps {
  simulation: SimulationState;
}

export default function Header({ simulation }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="header-logo">
        <span className="logo-icon">O</span>
        <div className="logo-text">
          <span className="logo-title">OZON Tech</span>
          <span className="logo-subtitle">Sorter Simulation</span>
        </div>
      </div>
      
      <div className="header-nav">
        <a href="#demo" className="nav-link">Демо</a>
        <a href="#scenarios" className="nav-link">Сценарии</a>
        <a href="#criteria" className="nav-link">Критерии</a>
        <a href="#engineering" className="nav-link">Инженерный режим</a>
      </div>
      
      <div className="header-status-compact">
        <div className={`status-dot ${simulation.systemStatus.toLowerCase()}`}></div>
        <span>{simulation.systemStatus}</span>
        <span className="sim-time">t+{(simulation.simTimeMs / 1000).toFixed(1)}s</span>
      </div>
    </header>
  );
}
