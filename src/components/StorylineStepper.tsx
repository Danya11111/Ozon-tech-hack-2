import type { MachineState, SimulationState } from '../domain/types';

type StepKey = 'detection' | 'classification' | 'decision' | 'command' | 'routing';
type StepStatus = 'active' | 'completed' | 'pending';

const STEPS: Array<{ key: StepKey; number: number; label: string; description: string }> = [
  { key: 'detection', number: 1, label: 'Detection', description: 'Камера и датчики снимают габариты' },
  { key: 'classification', number: 2, label: 'Classification', description: 'Правила проверяют размеры и форму' },
  { key: 'decision', number: 3, label: 'Decision', description: 'Система выбирает категорию B/C/D' },
  { key: 'command', number: 4, label: 'Command', description: 'Формируется команда ROUTE_TO_*' },
  { key: 'routing', number: 5, label: 'Routing', description: 'Товар уходит в целевую зону' },
];

function activeStep(state: MachineState): StepKey | null {
  if (state === 'IDLE') return null;
  if (state === 'MOVING_TO_CAMERA' || state === 'DETECTING') return 'detection';
  if (state === 'MOVING_TO_GATE' || state === 'WAITING_AT_GATE') return 'classification';
  if (state === 'CLASSIFYING') return 'decision';
  if (state.startsWith('ROUTE_TO_')) return 'command';
  if (state === 'RETURN_HOME') return 'routing';
  if (state === 'FAULT' || state === 'EMERGENCY_STOP') return 'routing';
  return null;
}

function stepStatus(key: StepKey, current: StepKey | null, machineState: MachineState): StepStatus {
  if (machineState === 'IDLE') return 'pending';

  const order: StepKey[] = ['detection', 'classification', 'decision', 'command', 'routing'];
  const currentIndex = current ? order.indexOf(current) : -1;
  const keyIndex = order.indexOf(key);

  if (machineState === 'RETURN_HOME') {
    return keyIndex < order.length - 1 ? 'completed' : 'active';
  }

  if (machineState === 'FAULT' || machineState === 'EMERGENCY_STOP') {
    return keyIndex <= currentIndex ? 'active' : 'pending';
  }

  if (keyIndex < currentIndex) return 'completed';
  if (keyIndex === currentIndex) return 'active';
  return 'pending';
}

export default function StorylineStepper({ simulation }: { simulation: SimulationState }) {
  const current = activeStep(simulation.machineState);

  return (
    <section className="storyline-section" id="storyline" aria-labelledby="storyline-title">
      <div className="section-header">
        <h2 id="storyline-title">Этапы цикла</h2>
        <p>Текущий этап системы в цепочке Detection → Classification → Decision → Command → Routing.</p>
      </div>

      <ol className="storyline-stepper">
        {STEPS.map((step) => {
          const status = stepStatus(step.key, current, simulation.machineState);
          return (
            <li key={step.key} className={`story-step step-${status}`}>
              <div className="step-indicator" aria-hidden="true">
                <span className="step-number">{step.number}</span>
              </div>
              <div className="step-content">
                <strong>{step.label}</strong>
                <span>{step.description}</span>
                <span className="step-status-label">
                  {status === 'active' ? 'Сейчас' : status === 'completed' ? 'Готово' : 'Ожидание'}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
