import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProductDemoSection from './components/ProductDemoSection';
import StorylineStepper from './components/StorylineStepper';
import ScenarioCards from './components/ScenarioCards';
import CPriorityExplanation from './components/CPriorityExplanation';
import CriteriaCards from './components/CriteriaCards';
import EngineeringDetails, { type EngineeringDetailsHandle } from './components/EngineeringDetails';
import { DEMO_STEPS } from './data/demoSteps';
import { SCENARIOS } from './data/scenarios';
import { createSimulation, stepSimulationToNextState } from './domain/simulation';
import type { ScenarioId, SimulationState } from './domain/types';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('normal_flow');
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const engineeringRef = useRef<EngineeringDetailsHandle>(null);

  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? SCENARIOS[0],
    [activeScenarioId],
  );

  const currentDemoStep = DEMO_STEPS[demoStepIndex];
  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulation(activeScenario));

  useEffect(() => {
    setSimulation(createSimulation(activeScenario));
  }, [activeScenario]);

  const handleStartDemo = () => {
    scrollToId('demo');
    setSimulation((current) => {
      if (current.machineState === 'IDLE' && !current.currentItem) {
        return stepSimulationToNextState(current);
      }
      return current;
    });
  };

  const handleNext = () => {
    const finished =
      simulation.machineState === 'RETURN_HOME' ||
      simulation.machineState === 'FAULT' ||
      simulation.machineState === 'EMERGENCY_STOP';

    if (finished) {
      const nextIndex = (demoStepIndex + 1) % DEMO_STEPS.length;
      setDemoStepIndex(nextIndex);
      setActiveScenarioId(DEMO_STEPS[nextIndex].scenarioId);
      return;
    }

    setSimulation((current) => stepSimulationToNextState(current));
  };

  const handleReset = () => {
    setSimulation(createSimulation(activeScenario));
  };

  const handleScenarioChange = (scenarioId: ScenarioId) => {
    setActiveScenarioId(scenarioId);
    const stepIdx = DEMO_STEPS.findIndex((step) => step.scenarioId === scenarioId);
    if (stepIdx >= 0) {
      setDemoStepIndex(stepIdx);
    }
    scrollToId('demo');
  };

  const handleOpenEngineering = () => {
    engineeringRef.current?.open();
  };

  const handleShowScenarios = () => {
    scrollToId('scenarios');
  };

  const handleShowCPriority = () => {
    handleScenarioChange('c_priority');
  };

  return (
    <div className="product-page">
      <Header
        simulation={simulation}
        onReset={handleReset}
        onOpenDemo={() => scrollToId('demo')}
        onOpenScenarios={handleShowScenarios}
        onOpenEngineering={handleOpenEngineering}
      />

      <main className="product-main">
        <HeroSection
          onStartDemo={handleStartDemo}
          onShowScenarios={handleShowScenarios}
          onOpenEngineering={handleOpenEngineering}
        />

        <ProductDemoSection
          simulation={simulation}
          demoStepTitle={currentDemoStep.title}
          onStartDemo={handleStartDemo}
          onNext={handleNext}
          onReset={handleReset}
          onOpenEngineering={handleOpenEngineering}
        />

        <StorylineStepper simulation={simulation} />

        <ScenarioCards
          scenarios={SCENARIOS}
          activeScenarioId={activeScenarioId}
          onScenarioChange={handleScenarioChange}
        />

        <CPriorityExplanation onShowCPriority={handleShowCPriority} />

        <CriteriaCards onLinkedScenario={handleScenarioChange} />

        <EngineeringDetails
          ref={engineeringRef}
          simulation={simulation}
          onScenarioChange={handleScenarioChange}
        />
      </main>

      <footer className="site-footer">
        <p>OZON Tech Hackathon 2026 · Sorter Simulation · Product Demo</p>
      </footer>
    </div>
  );
}
