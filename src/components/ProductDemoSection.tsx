import SorterScene from './SorterScene';
import CurrentProofCard from './CurrentProofCard';
import StorylineStepper from './StorylineStepper';
import type { SimulationState } from '../domain/types';

interface Props {
  simulation: SimulationState;
  onNext: () => void;
  onReset: () => void;
  demoStepTitle: string;
}

export default function ProductDemoSection({ simulation, onNext, onReset, demoStepTitle }: Props) {
  return (
    <section className="product-demo-section" id="demo">
      <div className="demo-header">
        <h2>Live Demo</h2>
        <div className="demo-status">
          Текущий шаг: <strong>{demoStepTitle}</strong>
          <span className={`status-dot ${simulation.systemStatus.toLowerCase()}`}></span>
        </div>
      </div>
      
      <StorylineStepper simulation={simulation} />
      
      <div className="demo-layout">
        <div className="demo-scene-container">
          <SorterScene simulation={simulation} />
        </div>
        
        <div className="demo-proof-container">
          <CurrentProofCard simulation={simulation} />
          <div className="demo-controls">
            <button className="btn-primary" onClick={onNext}>Следующий шаг (Next)</button>
            <button className="btn-secondary" onClick={onReset}>Сброс (Reset)</button>
          </div>
        </div>
      </div>
    </section>
  );
}
