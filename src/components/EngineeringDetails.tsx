import { useState } from 'react';
import StateMachinePanel from './StateMachinePanel';
import TimelinePanel from './TimelinePanel';
import PidPanel from './PidPanel';
import EventLog from './EventLog';
import MetricsPanel from './MetricsPanel';
import SensorPanel from './SensorPanel';
import type { SimulationState } from '../domain/types';

export default function EngineeringDetails({ simulation }: { simulation: SimulationState }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="engineering-details-section" id="engineering">
      <div className="engineering-toggle" onClick={() => setIsOpen(!isOpen)}>
        <h2>Инженерные детали (Engineering Mode)</h2>
        <button className="btn-secondary">
          {isOpen ? 'Свернуть' : 'Развернуть'}
        </button>
      </div>

      {isOpen && (
        <div className="engineering-content">
          <div className="engineering-grid">
            <div className="eng-panel"><StateMachinePanel currentState={simulation.machineState} /></div>
            <div className="eng-panel"><MetricsPanel metrics={simulation.metrics} /></div>
            <div className="eng-panel"><SensorPanel simulation={simulation} /></div>
            <div className="eng-panel"><TimelinePanel simulation={simulation} /></div>
            <div className="eng-panel"><PidPanel pid={simulation.pid} metrics={simulation.metrics} status={simulation.systemStatus} /></div>
            <div className="eng-panel"><EventLog events={simulation.events} /></div>
          </div>
        </div>
      )}
    </section>
  );
}
