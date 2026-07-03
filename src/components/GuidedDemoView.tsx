import { useEffect } from 'react';
import SorterScene from './SorterScene';
import CurrentProofCard from './CurrentProofCard';
import { OZON_CRITERIA } from '../data/criteria';
import type { DemoStep, Scenario, ScenarioId, SimulationState, PresentationMode } from '../domain/types';

interface GuidedDemoViewProps {
  simulation: SimulationState;
  scenarios: Scenario[];
  activeScenarioId: ScenarioId;
  presentationMode: PresentationMode;
  safeDemoEnabled: boolean;
  demoSteps: DemoStep[];
  demoStepIndex: number;
  currentDemoStep: DemoStep;
  pendingFaultStepId?: string;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onScenarioChange: (scenarioId: ScenarioId) => void;
  onPresentationModeChange: (mode: any) => void;
  onSafeDemoChange: (enabled: boolean) => void;
  onDemoStepChange: (index: number) => void;
  onApplyDemoStepScenario: (step: DemoStep) => void;
  onRunPreferredAction: (step: DemoStep) => void;
  onRestartDemo: () => void;
}

export default function GuidedDemoView({
  simulation,
  scenarios,
  activeScenarioId,
  demoSteps,
  demoStepIndex,
  currentDemoStep,
  pendingFaultStepId,
  safeDemoEnabled,
  onStart,
  onPause,
  onReset,
  onStep,
  onPresentationModeChange,
  onDemoStepChange,
  onApplyDemoStepScenario,
  onRunPreferredAction,
  onRestartDemo,
}: GuidedDemoViewProps) {
  const isFaultStep = currentDemoStep.scenarioId === 'jam' || currentDemoStep.scenarioId === 'emergency_stop';
  const pendingFaultConfirmation = pendingFaultStepId === currentDemoStep.id;

  const handleStartDemo = () => {
    if (!simulation.currentItem && demoStepIndex === 0 && !simulation.running) {
      onRunPreferredAction(currentDemoStep);
    } else if (demoStepIndex === 0 && simulation.running) {
      onRestartDemo();
    } else {
      onRunPreferredAction(currentDemoStep);
    }
  };

  const handleNext = () => {
    onDemoStepChange(demoStepIndex + 1);
  };

  const handlePrevious = () => {
    onDemoStepChange(demoStepIndex - 1);
  };

  const relatedCriteriaList = OZON_CRITERIA.filter(c => currentDemoStep.relatedCriteria.includes(c.id));

  return (
    <div className="guided-demo-layout">
      {/* 1. Top Demo Header */}
      <header className="guided-header">
        <div className="guided-header-left">
          <p className="eyebrow">Guided Sorting Demo</p>
          <h1>Step {demoStepIndex + 1} / {demoSteps.length}: {currentDemoStep.title}</h1>
        </div>
        <div className="guided-header-center">
          <div className={`status-pill status-${simulation.systemStatus.toLowerCase()}`}>
            <span />
            {simulation.systemStatus}
          </div>
          <div className="scenario-label">Scenario: {simulation.scenario.name}</div>
        </div>
        <div className="guided-header-right">
          <button className="primary-action" onClick={handleStartDemo}>
            {simulation.currentItem ? 'Restart Guided Demo' : 'Start Guided Demo'}
          </button>
          <div className="nav-actions">
            <button onClick={handlePrevious} disabled={demoStepIndex === 0}>Previous</button>
            <button onClick={handleNext} disabled={demoStepIndex === demoSteps.length - 1}>Next</button>
          </div>
          <button onClick={onReset}>Reset</button>
          <button onClick={() => onPresentationModeChange('engineering')}>Back to Engineering</button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="guided-grid">
        {/* 2. Large Scene Area */}
        <section className="guided-left">
          <div className="panel panel-scene guided-scene-panel">
            <SorterScene simulation={simulation} />
            <div className="guided-metrics-strip">
              <div className="guided-metric">
                <span>Cycle Time</span>
                <strong>{simulation.metrics.avgCycleTimeMs} ms</strong>
              </div>
              <div className="guided-metric">
                <span>CV Latency</span>
                <strong>{simulation.metrics.cvLatencyMs} ms</strong>
              </div>
              <div className="guided-metric">
                <span>Actuator Latency</span>
                <strong>{simulation.metrics.actuatorLatencyMs} ms</strong>
              </div>
              <div className="guided-metric">
                <span>Throughput</span>
                <strong>{simulation.metrics.throughputItemsPerMin} items/min</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column */}
        <aside className="guided-right">
          {/* 3. Current Proof Card */}
          <CurrentProofCard simulation={simulation} />

          {/* 4. Demo Narration Card */}
          <section className="panel guided-narration">
            <div className="panel-heading">
              <p className="eyebrow">Demo Narration</p>
              <h2>{currentDemoStep.title}</h2>
            </div>
            <p className="explanation">{currentDemoStep.explanation}</p>
            <div className="narration-details">
              <div>
                <strong>Watch:</strong> {currentDemoStep.whatToWatch}
              </div>
              <div>
                <strong>Jury Value:</strong> {currentDemoStep.juryValue}
              </div>
            </div>
            <blockquote className="presenter-phrase">
              "{currentDemoStep.presenterPhrase}"
            </blockquote>
            {isFaultStep && safeDemoEnabled && (
              <button 
                className={`fault-confirm-btn ${pendingFaultConfirmation ? 'pending' : ''}`}
                onClick={() => onApplyDemoStepScenario(currentDemoStep)}
              >
                {pendingFaultConfirmation ? 'Click again to confirm fault scenario' : 'Apply fault scenario'}
              </button>
            )}
          </section>

          {/* 5. Criteria Snapshot */}
          <section className="panel guided-criteria">
            <div className="panel-heading">
              <p className="eyebrow">Criteria Snapshot</p>
              <h2>This step covers</h2>
            </div>
            <div className="criteria-list-mini">
              {relatedCriteriaList.map(c => (
                <div key={c.id} className="criterion-mini">
                  <div className="criterion-mini-header">
                    <strong>{c.title}</strong>
                    <span className={`criterion-status status-${c.status.replace(/ /g, '-')}`}>{c.status}</span>
                  </div>
                  <p>{c.evidence}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}