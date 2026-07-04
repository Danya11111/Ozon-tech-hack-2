import { forwardRef, useImperativeHandle, useState } from 'react';
import StateMachinePanel from './StateMachinePanel';
import TimelinePanel from './TimelinePanel';
import PidPanel from './PidPanel';
import EventLog from './EventLog';
import MetricsPanel from './MetricsPanel';
import SensorPanel from './SensorPanel';
import ScenarioPanel from './ScenarioPanel';
import OzonCriteriaPanel from './OzonCriteriaPanel';
import SorterScene from './SorterScene';
import { DEMO_STEPS } from '../data/demoSteps';
import { SCENARIOS } from '../data/scenarios';
import type { ScenarioId, SimulationState } from '../domain/types';

export interface EngineeringDetailsHandle {
  open: () => void;
}

interface Props {
  simulation: SimulationState;
  onScenarioChange: (id: ScenarioId) => void;
}

const EngineeringDetails = forwardRef<EngineeringDetailsHandle, Props>(
  function EngineeringDetails({ simulation, onScenarioChange }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const currentStep =
      DEMO_STEPS.find((step) => step.scenarioId === simulation.scenario.id) ?? DEMO_STEPS[0];

    useImperativeHandle(ref, () => ({
      open: () => {
        setIsOpen(true);
        requestAnimationFrame(() => {
          document.getElementById('engineering')?.scrollIntoView({ behavior: 'smooth' });
        });
      },
    }));

    return (
      <section className="engineering-details-section" id="engineering" aria-labelledby="engineering-title">
        <div className="engineering-toggle">
          <div>
            <p className="section-eyebrow">For experts</p>
            <h2 id="engineering-title">Engineering Details</h2>
            <p className="engineering-lead">
              Полные технические панели: state machine, sensors, PID, timeline, event log и критерии.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsOpen((value) => !value)}
            aria-expanded={isOpen}
            aria-controls="engineering-content"
          >
            {isOpen ? 'Свернуть' : 'Открыть инженерный режим'}
          </button>
        </div>

        {isOpen ? (
          <div className="engineering-content" id="engineering-content">
            <div className="eng-panel eng-panel-wide">
              <SorterScene simulation={simulation} variant="full" />
            </div>

            <div className="engineering-grid">
              <div className="eng-panel">
                <StateMachinePanel currentState={simulation.machineState} />
              </div>
              <div className="eng-panel">
                <MetricsPanel metrics={simulation.metrics} />
              </div>
              <div className="eng-panel">
                <SensorPanel simulation={simulation} />
              </div>
              <div className="eng-panel">
                <TimelinePanel simulation={simulation} />
              </div>
              <div className="eng-panel">
                <PidPanel
                  pid={simulation.pid}
                  metrics={simulation.metrics}
                  status={simulation.systemStatus}
                />
              </div>
              <div className="eng-panel">
                <ScenarioPanel
                  scenarios={SCENARIOS}
                  activeScenarioId={simulation.scenario.id}
                  onScenarioChange={onScenarioChange}
                />
              </div>
              <div className="eng-panel eng-panel-wide">
                <EventLog events={simulation.events} />
              </div>
              <div className="eng-panel eng-panel-wide">
                <OzonCriteriaPanel currentStep={currentStep} />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  },
);

export default EngineeringDetails;
