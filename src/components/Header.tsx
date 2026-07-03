import type { PresentationMode, SimulationState } from '../domain/types';

interface HeaderProps {
  simulation: SimulationState;
  presentationMode: PresentationMode;
  safeDemoEnabled: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onPresentationModeChange: (mode: PresentationMode) => void;
  onSafeDemoChange: (enabled: boolean) => void;
}

export default function Header({
  simulation,
  presentationMode,
  safeDemoEnabled,
  onStart,
  onPause,
  onReset,
  onStep,
  onPresentationModeChange,
  onSafeDemoChange,
}: HeaderProps) {
  const locked = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';

  return (
    <header className="header">
      <div>
        <p className="eyebrow">Intelligent robotic sorting line</p>
        <h1>OZON Tech Sorter Simulation</h1>
      </div>
      <div className="header-status">
        <div className="mode-toggle" role="group" aria-label="Dashboard mode">
          <button className={presentationMode === 'engineering' ? 'active' : ''} onClick={() => onPresentationModeChange('engineering')}>Engineering Mode</button>
          <button className={presentationMode === 'presentation' ? 'active' : ''} onClick={() => onPresentationModeChange('presentation')}>Presentation Dashboard</button>
          <button className={presentationMode === 'guided' ? 'active' : ''} onClick={() => onPresentationModeChange('guided')}>Guided Demo</button>
        </div>
        {presentationMode === 'presentation' ? (
          <button className={safeDemoEnabled ? 'safe-demo-toggle active' : 'safe-demo-toggle'} onClick={() => onSafeDemoChange(!safeDemoEnabled)}>
            Safe Demo: {safeDemoEnabled ? 'ON' : 'OFF'}
          </button>
        ) : null}
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
