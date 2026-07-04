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
import { createSimulation, stepSimulationToNextState, setRunning } from './domain/simulation';
import type { ScenarioId, SimulationState } from './domain/types';
import {
  createDemoDirectorState,
  startAutoDemo,
  pauseAutoDemo,
  resumeAutoDemo,
  stopAutoDemo,
  updateAutoDemo,
  type DemoDirectorState,
} from './domain/demoDirector';

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
  
  // Auto Demo Director state
  const [demoDirector, setDemoDirector] = useState<DemoDirectorState>(() =>
    createDemoDirectorState(activeScenario),
  );
  
  // Use refs to avoid triggering re-renders on every frame
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(performance.now());
  const UPDATE_INTERVAL = 100; // Update UI only every 100ms instead of every frame

  useEffect(() => {
    setSimulation(createSimulation(activeScenario));
    setDemoDirector(createDemoDirectorState(activeScenario));
  }, [activeScenario]);
  
  // Auto Demo loop - throttled updates to prevent render loop
  useEffect(() => {
    if (!demoDirector.isAutoDemoRunning || demoDirector.paused) {
      // Clean up RAF on stop/pause
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const deltaMs = now - lastTime;
      
      // Only update React state every UPDATE_INTERVAL ms (not every frame!)
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL) {
        lastTime = now;
        lastUpdateRef.current = now;

        // Batch state updates together
        setDemoDirector((prev) => {
          const category = simulation.currentItem?.classification.category;
          return updateAutoDemo(prev, deltaMs, category);
        });

        setSimulation((current) => {
          if (current.machineState === 'IDLE' && !current.currentItem) {
            return setRunning(stepSimulationToNextState(current), true);
          }
          if (
            current.machineState === 'RETURN_HOME' ||
            current.machineState === 'FAULT' ||
            current.machineState === 'EMERGENCY_STOP'
          ) {
            return createSimulation(activeScenario);
          }
          return setRunning(current, true);
        });
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [demoDirector.isAutoDemoRunning, demoDirector.paused, activeScenario]); // Removed circular dependency!

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
  
  // Auto Demo handlers
  const handleStartAutoDemo = () => {
    scrollToId('demo');
    setDemoDirector((prev) => startAutoDemo(prev));
    setSimulation(createSimulation(activeScenario));
  };

  const handlePauseAutoDemo = () => {
    setDemoDirector((prev) => pauseAutoDemo(prev));
  };

  const handleResumeAutoDemo = () => {
    setDemoDirector((prev) => resumeAutoDemo(prev));
  };

  const handleStopAutoDemo = () => {
    setDemoDirector((prev) => stopAutoDemo(prev));
    setSimulation(createSimulation(activeScenario));
  };

  const handleToggleAutoDemo = () => {
    if (demoDirector.isAutoDemoRunning) {
      if (demoDirector.paused) {
        handleResumeAutoDemo();
      } else {
        handlePauseAutoDemo();
      }
    } else {
      handleStartAutoDemo();
    }
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
          demoDirector={demoDirector}
          onStartDemo={handleStartDemo}
          onNext={handleNext}
          onReset={handleReset}
          onOpenEngineering={handleOpenEngineering}
          onStartAutoDemo={handleStartAutoDemo}
          onToggleAutoDemo={handleToggleAutoDemo}
          onStopAutoDemo={handleStopAutoDemo}
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
