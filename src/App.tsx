import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './pages/MainPage';
import DetailsPage from './pages/DetailsPage';
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
import { getPlaylistCase, nextPlaylistIndex } from './domain/demoPlaylist';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function AppContent() {
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('normal_flow');
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const [playlistIndex, setPlaylistIndex] = useState(0);

  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? SCENARIOS[0],
    [activeScenarioId],
  );

  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulation(activeScenario));

  const [demoDirector, setDemoDirector] = useState<DemoDirectorState>(() =>
    createDemoDirectorState(activeScenario),
  );

  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(performance.now());
  const UPDATE_INTERVAL = 100;

  useEffect(() => {
    setSimulation(createSimulation(activeScenario));
    setDemoDirector(createDemoDirectorState(activeScenario));
  }, [activeScenario]);

  useEffect(() => {
    if (!demoDirector.isAutoDemoRunning || demoDirector.paused) {
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

      if (now - lastUpdateRef.current >= UPDATE_INTERVAL) {
        lastTime = now;
        lastUpdateRef.current = now;

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
  }, [demoDirector.isAutoDemoRunning, demoDirector.paused, activeScenario]);

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

  // Main page handlers - use playlist
  const handleMainPlay = () => {
    const currentCase = getPlaylistCase(playlistIndex);
    setActiveScenarioId(currentCase.scenarioId);
    setDemoDirector((prev) => startAutoDemo(prev));
    // TODO: Auto-advance to next playlist case when scenario completes
    // For now, plays the current playlist case only
  };

  const handleMainPause = () => {
    setDemoDirector((prev) => pauseAutoDemo(prev));
  };

  const handleMainStop = () => {
    setDemoDirector((prev) => stopAutoDemo(prev));
    setSimulation(createSimulation(activeScenario));
    setPlaylistIndex(0);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainPage
            simulation={simulation}
            demoDirector={demoDirector}
            playlistIndex={playlistIndex}
            onPlay={handleMainPlay}
            onPause={handleMainPause}
            onStop={handleMainStop}
          />
        }
      />
      <Route
        path="/details"
        element={
          <DetailsPage
            simulation={simulation}
            demoStepIndex={demoStepIndex}
            demoDirector={demoDirector}
            activeScenarioId={activeScenarioId}
            onStartDemo={handleStartDemo}
            onNext={handleNext}
            onReset={handleReset}
            onScenarioChange={handleScenarioChange}
            onStartAutoDemo={handleStartAutoDemo}
            onToggleAutoDemo={handleToggleAutoDemo}
            onStopAutoDemo={handleStopAutoDemo}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
