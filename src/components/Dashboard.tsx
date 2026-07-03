import Header from './Header';
import SorterScene from './SorterScene';
import CurrentItemPanel from './CurrentItemPanel';
import ClassificationPanel from './ClassificationPanel';
import StateMachinePanel from './StateMachinePanel';
import MetricsPanel from './MetricsPanel';
import EventLog from './EventLog';
import ScenarioPanel from './ScenarioPanel';
import SensorPanel from './SensorPanel';
import PidPanel from './PidPanel';
import TimelinePanel from './TimelinePanel';
import PresentationModePanel from './PresentationModePanel';
import OzonCriteriaPanel from './OzonCriteriaPanel';
import type { DemoFocusArea, DemoStep, PresentationMode, Scenario, ScenarioId, SimulationState } from '../domain/types';

interface DashboardProps {
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
  onPresentationModeChange: (mode: PresentationMode) => void;
  onSafeDemoChange: (enabled: boolean) => void;
  onDemoStepChange: (index: number) => void;
  onApplyDemoStepScenario: (step: DemoStep) => void;
  onRunPreferredAction: (step: DemoStep) => void;
  onRestartDemo: () => void;
}

function focusClass(mode: PresentationMode, activeFocus: DemoFocusArea, panelFocus: DemoFocusArea | DemoFocusArea[]): string {
  if (mode !== 'presentation') {
    return '';
  }
  const focusList = Array.isArray(panelFocus) ? panelFocus : [panelFocus];
  return focusList.includes(activeFocus) || (activeFocus === 'safety' && focusList.includes('scene')) ? 'focus-highlight' : 'presentation-muted';
}

export default function Dashboard({
  simulation,
  scenarios,
  activeScenarioId,
  presentationMode,
  safeDemoEnabled,
  demoSteps,
  demoStepIndex,
  currentDemoStep,
  pendingFaultStepId,
  onStart,
  onPause,
  onReset,
  onStep,
  onScenarioChange,
  onPresentationModeChange,
  onSafeDemoChange,
  onDemoStepChange,
  onApplyDemoStepScenario,
  onRunPreferredAction,
  onRestartDemo,
}: DashboardProps) {
  const focusArea = currentDemoStep.focusArea;

  return (
    <div className={`app-shell mode-${presentationMode}`}>
      <Header
        simulation={simulation}
        presentationMode={presentationMode}
        safeDemoEnabled={safeDemoEnabled}
        onStart={onStart}
        onPause={onPause}
        onReset={onReset}
        onStep={onStep}
        onPresentationModeChange={onPresentationModeChange}
        onSafeDemoChange={onSafeDemoChange}
      />
      {presentationMode === 'presentation' ? (
        <PresentationModePanel
          steps={demoSteps}
          currentStep={currentDemoStep}
          currentIndex={demoStepIndex}
          activeScenarioId={activeScenarioId}
          safeDemoEnabled={safeDemoEnabled}
          pendingFaultStepId={pendingFaultStepId}
          onPrevious={() => onDemoStepChange(demoStepIndex - 1)}
          onNext={() => onDemoStepChange(demoStepIndex + 1)}
          onRestart={onRestartDemo}
          onApplyScenario={() => onApplyDemoStepScenario(currentDemoStep)}
          onRunPreferredAction={() => onRunPreferredAction(currentDemoStep)}
        />
      ) : null}
      <main className="dashboard-grid">
        <section className={`scene-column panel panel-scene ${focusClass(presentationMode, focusArea, ['scene', 'safety'])}`}>
          <SorterScene simulation={simulation} />
        </section>
        <aside className="right-rail">
          <div className={focusClass(presentationMode, focusArea, 'classification')}><CurrentItemPanel simulation={simulation} /></div>
          <div className={focusClass(presentationMode, focusArea, 'classification')}><ClassificationPanel simulation={simulation} /></div>
          <div className={focusClass(presentationMode, focusArea, 'timeline')}><StateMachinePanel currentState={simulation.machineState} /></div>
          <div className={focusClass(presentationMode, focusArea, 'scene')}><SensorPanel simulation={simulation} /></div>
        </aside>
        <section className="bottom-row">
          <div className={focusClass(presentationMode, focusArea, 'timeline')}><MetricsPanel metrics={simulation.metrics} /></div>
          <div className={focusClass(presentationMode, focusArea, 'timeline')}><TimelinePanel simulation={simulation} /></div>
          <div className={focusClass(presentationMode, focusArea, ['pid', 'safety'])}><PidPanel pid={simulation.pid} metrics={simulation.metrics} status={simulation.systemStatus} /></div>
          <div className={focusClass(presentationMode, focusArea, 'eventLog')}><EventLog events={simulation.events} /></div>
          <div className={focusClass(presentationMode, focusArea, 'criteria')}>
            <OzonCriteriaPanel currentStep={currentDemoStep} />
          </div>
          <div className="scenario-panel-wrap">
            <ScenarioPanel
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              onScenarioChange={onScenarioChange}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
