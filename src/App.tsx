import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import {
  createPlaybackState,
  startPlayback,
  pausePlayback,
  resumePlayback,
  stopPlayback,
  updatePlayback,
  type ContinuousPlaybackState,
} from './domain/continuousPlayback';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function AppContent() {
  // Details page state (existing simulation system)
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('normal_flow');
  const [demoStepIndex, setDemoStepIndex] = useState(0);

  const activeScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? SCENARIOS[0],
    [activeScenarioId],
  );

  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulation(activeScenario));

  const [demoDirector, setDemoDirector] = useState<DemoDirectorState>(() =>
    createDemoDirectorState(activeScenario),
  );

  // Main page state (continuous playback)
  const [playback, setPlayback] = useState<ContinuousPlaybackState>(() => createPlaybackState());

  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(performance.now());
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastRef = useRef(performance.now());
  const UPDATE_INTERVAL = 100;
  const PLAYBACK_INTERVAL = 50; // More frequent updates for smooth animation

  // Sync activeScenario changes
  useEffect(() => {
    setSimulation(createSimulation(activeScenario));
    setDemoDirector(createDemoDirectorState(activeScenario));
  }, [activeScenario]);

  // Details page auto demo loop
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
  }, [demoDirector.isAutoDemoRunning, demoDirector.paused, activeScenario, simulation.currentItem?.classification.category]);

  // Main page continuous playback loop
  useEffect(() => {
    if (playback.status !== 'running') {
      if (playbackRafRef.current) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = performance.now();
      const deltaMs = now - playbackLastRef.current;

      if (deltaMs >= PLAYBACK_INTERVAL) {
        playbackLastRef.current = now;
        setPlayback((prev) => updatePlayback(prev, deltaMs));
      }

      playbackRafRef.current = requestAnimationFrame(tick);
    };

    playbackLastRef.current = performance.now();
    playbackRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (playbackRafRef.current) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [playback.status]);

  // Details page handlers
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

  // Main page handlers - continuous playback
  const handleMainPlay = useCallback(() => {
    setPlayback((prev) => {
      if (prev.status === 'paused') {
        return resumePlayback(prev);
      }
      return startPlayback(prev);
    });
  }, []);

  const handleMainPause = useCallback(() => {
    setPlayback((prev) => pausePlayback(prev));
  }, []);

  const handleMainStop = useCallback(() => {
    setPlayback(stopPlayback);
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainPage
            playback={playback}
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
