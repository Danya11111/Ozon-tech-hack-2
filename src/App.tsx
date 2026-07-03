import { useEffect, useMemo, useState } from 'react';
import Dashboard from './components/Dashboard';
import { DEMO_STEPS } from './data/demoSteps';
import { SCENARIOS } from './data/scenarios';
import { createSimulation, setRunning, stepSimulation, stepSimulationToNextState } from './domain/simulation';
import type { DemoStep, PresentationMode, ScenarioId, SimulationState } from './domain/types';

const TICK_MS = 250;

function isFaultDemoStep(step: DemoStep): boolean {
  return step.scenarioId === 'jam' || step.scenarioId === 'emergency_stop';
}

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('normal_flow');
  const [presentationMode, setPresentationMode] = useState<PresentationMode>('engineering');
  const [safeDemoEnabled, setSafeDemoEnabled] = useState(true);
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const [pendingFaultStepId, setPendingFaultStepId] = useState<string | undefined>();
  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? SCENARIOS[0],
    [activeScenarioId],
  );
  const currentDemoStep = DEMO_STEPS[demoStepIndex];
  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulation(activeScenario));

  useEffect(() => {
    setSimulation(createSimulation(activeScenario));
  }, [activeScenario]);

  useEffect(() => {
    if (!simulation.running) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSimulation((current) => stepSimulation(current, TICK_MS));
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [simulation.running]);

  const handleStart = () => setSimulation((current) => setRunning(current, true));
  const handlePause = () => setSimulation((current) => setRunning(current, false));
  const handleReset = () => setSimulation(createSimulation(activeScenario));
  const handleStep = () => setSimulation((current) => stepSimulationToNextState(current));
  const handleScenarioChange = (scenarioId: ScenarioId) => {
    setPendingFaultStepId(undefined);
    setActiveScenarioId(scenarioId);
  };

  const handleDemoStepChange = (nextIndex: number) => {
    setPendingFaultStepId(undefined);
    setDemoStepIndex(Math.max(0, Math.min(nextIndex, DEMO_STEPS.length - 1)));
  };

  const handleApplyDemoStepScenario = (step: DemoStep) => {
    if (presentationMode === 'presentation' && safeDemoEnabled && isFaultDemoStep(step) && pendingFaultStepId !== step.id) {
      setPendingFaultStepId(step.id);
      return;
    }

    setPendingFaultStepId(undefined);
    setActiveScenarioId(step.scenarioId);
  };

  const handleRunPreferredAction = (step: DemoStep) => {
    if (activeScenarioId !== step.scenarioId) {
      handleApplyDemoStepScenario(step);
      return;
    }

    if (step.preferredAction === 'start') {
      handleStart();
    } else if (step.preferredAction === 'pause') {
      handlePause();
    } else if (step.preferredAction === 'reset') {
      handleReset();
    } else {
      handleStep();
    }
  };

  const handleRestartDemo = () => {
    setPendingFaultStepId(undefined);
    setDemoStepIndex(0);
    setActiveScenarioId(DEMO_STEPS[0].scenarioId);
  };

  return (
    <Dashboard
      simulation={simulation}
      scenarios={SCENARIOS}
      activeScenarioId={activeScenarioId}
      presentationMode={presentationMode}
      safeDemoEnabled={safeDemoEnabled}
      demoSteps={DEMO_STEPS}
      demoStepIndex={demoStepIndex}
      currentDemoStep={currentDemoStep}
      pendingFaultStepId={pendingFaultStepId}
      onStart={handleStart}
      onPause={handlePause}
      onReset={handleReset}
      onStep={handleStep}
      onScenarioChange={handleScenarioChange}
      onPresentationModeChange={setPresentationMode}
      onSafeDemoChange={setSafeDemoEnabled}
      onDemoStepChange={handleDemoStepChange}
      onApplyDemoStepScenario={handleApplyDemoStepScenario}
      onRunPreferredAction={handleRunPreferredAction}
      onRestartDemo={handleRestartDemo}
    />
  );
}
