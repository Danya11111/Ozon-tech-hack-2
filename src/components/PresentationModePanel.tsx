import type { DemoStep, ScenarioId } from '../domain/types';

interface PresentationModePanelProps {
  steps: DemoStep[];
  currentStep: DemoStep;
  currentIndex: number;
  activeScenarioId: ScenarioId;
  safeDemoEnabled: boolean;
  pendingFaultStepId?: string;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
  onApplyScenario: () => void;
  onRunPreferredAction: () => void;
}

export default function PresentationModePanel({
  steps,
  currentStep,
  currentIndex,
  activeScenarioId,
  safeDemoEnabled,
  pendingFaultStepId,
  onPrevious,
  onNext,
  onRestart,
  onApplyScenario,
  onRunPreferredAction,
}: PresentationModePanelProps) {
  const scenarioApplied = activeScenarioId === currentStep.scenarioId;
  const pendingFaultConfirmation = pendingFaultStepId === currentStep.id;
  const isFaultStep = currentStep.scenarioId === 'jam' || currentStep.scenarioId === 'emergency_stop';

  return (
    <section className="presentation-panel panel">
      <div className="presentation-step-index">Step {currentIndex + 1} / {steps.length}</div>
      <div className="presentation-copy">
        <p className="eyebrow">Presentation Mode</p>
        <h2>{currentStep.title}</h2>
        <p>{currentStep.explanation}</p>
      </div>
      <div className="presentation-proof">
        <div>
          <strong>What to watch</strong>
          <span>{currentStep.whatToWatch}</span>
        </div>
        <div>
          <strong>What it proves for jury</strong>
          <span>{currentStep.juryValue}</span>
        </div>
        <div>
          <strong>Current proof</strong>
          <span>classification decision {'->'} control command {'->'} physical route {'->'} logged result</span>
        </div>
      </div>
      <blockquote>{currentStep.presenterPhrase}</blockquote>
      <div className="presentation-meta">
        <span>Recommended scenario: <strong>{currentStep.scenarioId}</strong></span>
        <span>Action: <strong>{currentStep.preferredAction}</strong></span>
        <span>Focus: <strong>{currentStep.focusArea}</strong></span>
        <span>Safe Demo: <strong>{safeDemoEnabled ? 'ON' : 'OFF'}</strong></span>
      </div>
      <div className="criteria-tags">
        {currentStep.relatedCriteria.map((criterion) => <span key={criterion}>{criterion}</span>)}
      </div>
      {safeDemoEnabled && isFaultStep && pendingFaultConfirmation ? (
        <p className="confirm-note">Click “Confirm fault scenario” again to intentionally switch to {currentStep.scenarioId}.</p>
      ) : null}
      <div className="presentation-actions">
        <button onClick={onPrevious} disabled={currentIndex === 0}>Previous step</button>
        <button onClick={onNext} disabled={currentIndex === steps.length - 1}>Next step</button>
        <button onClick={onRestart}>Restart demo</button>
        <button className={scenarioApplied ? 'active' : ''} onClick={onApplyScenario}>
          {pendingFaultConfirmation ? 'Confirm fault scenario' : scenarioApplied ? 'Scenario applied' : 'Apply scenario'}
        </button>
        <button onClick={onRunPreferredAction}>{scenarioApplied ? 'Run suggested action' : 'Apply then run'}</button>
      </div>
    </section>
  );
}
