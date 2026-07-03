import type { SimulationState } from '../domain/types';

export default function StorylineStepper({ simulation }: { simulation: SimulationState }) {
  const state = simulation.machineState;
  
  const isDetection = state === 'MOVING_TO_CAMERA' || state === 'DETECTING';
  const isClassification = state === 'MOVING_TO_GATE' || state === 'WAITING_AT_GATE' || state === 'CLASSIFYING';
  const isCommand = state.startsWith('ROUTE_TO_');
  const isRouting = state === 'RETURN_HOME';
  
  const item = simulation.currentItem;
  
  return (
    <div className="storyline-stepper">
      <Step 
        label="1. Detection" 
        desc="Распознавание габаритов" 
        active={isDetection} 
        done={Boolean(item) && !isDetection} 
      />
      <Step 
        label="2. Classification" 
        desc="Дерево решений" 
        active={isClassification} 
        done={Boolean(item?.classification) && !isClassification && !isDetection} 
      />
      <Step 
        label="3. Decision" 
        desc="Выбор категории" 
        active={isClassification && state === 'CLASSIFYING'} 
        done={Boolean(item?.classification)} 
      />
      <Step 
        label="4. Command" 
        desc="Сигнал механизмам" 
        active={isCommand} 
        done={isRouting} 
      />
      <Step 
        label="5. Routing" 
        desc="Движение в зону" 
        active={isCommand || isRouting} 
        done={isRouting} 
      />
    </div>
  );
}

function Step({ label, desc, active, done }: { label: string, desc: string, active: boolean, done: boolean }) {
  let statusClass = 'step-pending';
  if (active) statusClass = 'step-active';
  else if (done) statusClass = 'step-done';

  return (
    <div className={`story-step ${statusClass}`}>
      <div className="step-indicator">
        <div className="step-dot"></div>
      </div>
      <div className="step-content">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
    </div>
  );
}
