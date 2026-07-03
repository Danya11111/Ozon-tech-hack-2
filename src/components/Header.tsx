import type { SimulationState } from '../domain/types';

interface HeaderProps {
  simulation: SimulationState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
}

export default function Header({ simulation, onStart, onPause, onReset, onStep }: HeaderProps) {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">Intelligent robotic sorting line</p>
        <h1>OZON Tech Sorter Simulation</h1>
      </div>
      <div className="header-status">
        <div className={`status-pill status-${simulation.systemStatus.toLowerCase()}`}>
          <span />
          {simulation.systemStatus}
        </div>
        <div className="scenario-label">Scenario: {simulation.scenario.name}</div>
        <div className="header-actions">
          <button onClick={onStart}>Start</button>
          <button onClick={onPause}>Pause</button>
          <button onClick={onReset}>Reset</button>
          <button onClick={onStep}>Step</button>
        </div>
      </div>
    </header>
  );
}
