import { useEffect, useMemo, useState } from 'react';
import Dashboard from './components/Dashboard';
import { SCENARIOS } from './data/scenarios';
import { createSimulation, setRunning, stepSimulation, stepSimulationToNextState } from './domain/simulation';
import type { ScenarioId, SimulationState } from './domain/types';

const TICK_MS = 250;

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('normal_flow');
  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? SCENARIOS[0],
    [activeScenarioId],
  );
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
  const handleScenarioChange = (scenarioId: ScenarioId) => setActiveScenarioId(scenarioId);

  return (
    <Dashboard
      simulation={simulation}
      scenarios={SCENARIOS}
      activeScenarioId={activeScenarioId}
      onStart={handleStart}
      onPause={handlePause}
      onReset={handleReset}
      onStep={handleStep}
      onScenarioChange={handleScenarioChange}
    />
  );
}
