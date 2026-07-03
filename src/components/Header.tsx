import type { SimulationState } from '../domain/types';

interface HeaderProps {
  simulation: SimulationState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
}

export default function Header({ simulation, onStart, onPause, onReset, onStep }: HeaderProps) {
  const locked = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';

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
        <div className="scenario-label">Sim t+{(simulation.simTimeMs / 1000).toFixed(1)}s</div>
        <div className="header-actions">
          <button onClick={onStart} disabled={locked}>Start</button>
          <button onClick={onPause}>Pause</button>
          <button onClick={onReset}>Reset</button>
          <button onClick={onStep} disabled={locked}>Step state</button>
        </div>
      </div>
    </header>
  );
}
