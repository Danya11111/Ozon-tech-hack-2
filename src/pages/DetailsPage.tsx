import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import ProductDemoSection from '../components/ProductDemoSection';
import StorylineStepper from '../components/StorylineStepper';
import ScenarioCards from '../components/ScenarioCards';
import CPriorityExplanation from '../components/CPriorityExplanation';
import CriteriaCards from '../components/CriteriaCards';
import EngineeringDetails, { type EngineeringDetailsHandle } from '../components/EngineeringDetails';
import { DEMO_STEPS } from '../data/demoSteps';
import { SCENARIOS } from '../data/scenarios';
import type { ScenarioId, SimulationState } from '../domain/types';
import type { DemoDirectorState } from '../domain/demoDirector';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

interface DetailsPageProps {
  simulation: SimulationState;
  demoStepIndex: number;
  demoDirector: DemoDirectorState;
  activeScenarioId: ScenarioId;
  onStartDemo: () => void;
  onNext: () => void;
  onReset: () => void;
  onScenarioChange: (id: ScenarioId) => void;
  onStartAutoDemo: () => void;
  onToggleAutoDemo: () => void;
  onStopAutoDemo: () => void;
}

export default function DetailsPage({
  simulation,
  demoStepIndex,
  demoDirector,
  activeScenarioId,
  onStartDemo,
  onNext,
  onReset,
  onScenarioChange,
  onStartAutoDemo,
  onToggleAutoDemo,
  onStopAutoDemo,
}: DetailsPageProps) {
  const engineeringRef = useRef<EngineeringDetailsHandle>(null);

  const currentDemoStep = DEMO_STEPS[demoStepIndex];

  const handleOpenEngineering = () => {
    engineeringRef.current?.open();
  };

  const handleShowScenarios = () => {
    scrollToId('scenarios');
  };

  const handleShowCPriority = () => {
    onScenarioChange('c_priority');
  };

  return (
    <div className="product-page details-page">
      <Header
        simulation={simulation}
        onReset={onReset}
        onOpenDemo={() => scrollToId('demo')}
        onOpenScenarios={handleShowScenarios}
        onOpenEngineering={handleOpenEngineering}
      />

      {/* Back to main demo link */}
      <div className="back-to-main">
        <Link to="/" className="back-link">← Back to Full-Screen Demo</Link>
      </div>

      <main className="product-main">
        <HeroSection
          onStartDemo={onStartDemo}
          onShowScenarios={handleShowScenarios}
          onOpenEngineering={handleOpenEngineering}
        />

        <ProductDemoSection
          simulation={simulation}
          demoStepTitle={currentDemoStep.title}
          demoDirector={demoDirector}
          onStartDemo={onStartDemo}
          onNext={onNext}
          onReset={onReset}
          onOpenEngineering={handleOpenEngineering}
          onStartAutoDemo={onStartAutoDemo}
          onToggleAutoDemo={onToggleAutoDemo}
          onStopAutoDemo={onStopAutoDemo}
        />

        <StorylineStepper simulation={simulation} />

        <ScenarioCards
          scenarios={SCENARIOS}
          activeScenarioId={activeScenarioId}
          onScenarioChange={onScenarioChange}
        />

        <CPriorityExplanation onShowCPriority={handleShowCPriority} />

        <CriteriaCards onLinkedScenario={onScenarioChange} />

        <EngineeringDetails
          ref={engineeringRef}
          simulation={simulation}
          onScenarioChange={onScenarioChange}
        />
      </main>

      <footer className="site-footer">
        <p>OZON Tech Hackathon 2026 · Sorter Simulation · Product Demo</p>
      </footer>
    </div>
  );
}
