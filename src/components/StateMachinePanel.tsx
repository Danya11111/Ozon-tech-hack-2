import type { MachineState } from '../domain/types';

const states: MachineState[] = [
  'IDLE',
  'MOVING_TO_CAMERA',
  'DETECTING',
  'MOVING_TO_GATE',
  'WAITING_AT_GATE',
  'CLASSIFYING',
  'ROUTE_TO_B',
  'ROUTE_TO_C',
  'ROUTE_TO_D',
  'RETURN_HOME',
  'FAULT',
  'EMERGENCY_STOP',
];

export default function StateMachinePanel({ currentState }: { currentState: MachineState }) {
  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <p className="eyebrow">State machine</p>
        <h2>{currentState}</h2>
      </div>
      <div className="state-list">
        {states.map((state) => (
          <div key={state} className={state === currentState ? 'state active' : 'state'}>
            <span />
            {state}
          </div>
        ))}
      </div>
    </section>
  );
}
