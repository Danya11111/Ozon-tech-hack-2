import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import ProductDemoSection from './components/ProductDemoSection';
import ScenarioCards from './components/ScenarioCards';
import CriteriaCards from './components/CriteriaCards';
import EngineeringDetails from './components/EngineeringDetails';
import { DEMO_STEPS } from './data/demoSteps';
import { SCENARIOS } from './data/scenarios';
import { createSimulation, setRunning, stepSimulationToNextState } from './domain/simulation';
import type { ScenarioId, SimulationState } from './domain/types';

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('normal_flow');
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  
  const activeScenario = useMemo(
    () => SCENARIOS.find((s) => s.id === activeScenarioId) ?? SCENARIOS[0],
    [activeScenarioId],
  );
  
  const currentDemoStep = DEMO_STEPS[demoStepIndex];
  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulation(activeScenario));

  useEffect(() => {
    setSimulation(createSimulation(activeScenario));
  }, [activeScenario]);

  // We are not using automatic interval in the new product demo by default to keep it step-by-step
  // but if the user wants it to run automatically, we can preserve it if needed. 
  // Let's use handleNext to just step through.
  
  const handleStartDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
    if (!simulation.currentItem && demoStepIndex === 0) {
      setSimulation(stepSimulationToNextState(simulation));
    }
  };

  const handleNext = () => {
    // If simulation is finished or errored, we might need to reset or move to next scenario
    const isFinished = simulation.machineState === 'RETURN_HOME' || simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';
    
    if (isFinished) {
      const nextIndex = (demoStepIndex + 1) % DEMO_STEPS.length;
      setDemoStepIndex(nextIndex);
      setActiveScenarioId(DEMO_STEPS[nextIndex].scenarioId);
    } else {
      setSimulation((current) => stepSimulationToNextState(current));
    }
  };

  const handleReset = () => {
    setSimulation(createSimulation(activeScenario));
  };

  const handleScenarioChange = (scenarioId: ScenarioId) => {
    setActiveScenarioId(scenarioId);
    // Find first step that matches this scenario
    const stepIdx = DEMO_STEPS.findIndex(s => s.scenarioId === scenarioId);
    if (stepIdx >= 0) setDemoStepIndex(stepIdx);
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="product-page">
      <Header simulation={simulation} />
      
      <main className="product-main">
        <HeroSection onStartDemo={handleStartDemo} />
        
        <ProductDemoSection 
          simulation={simulation} 
          onNext={handleNext} 
          onReset={handleReset}
          demoStepTitle={currentDemoStep.title}
        />
        
        <ScenarioCards 
          scenarios={SCENARIOS} 
          activeScenarioId={activeScenarioId}
          onScenarioChange={handleScenarioChange}
        />
        
        <CriteriaCards />
        
        <EngineeringDetails simulation={simulation} />
      </main>
      
      <footer className="site-footer">
        <p>OZON Tech Hackathon 2026. Sorter Simulation.</p>
      </footer>
    </div>
  );
}
