import Header from './Header';
import SorterScene from './SorterScene';
import CurrentItemPanel from './CurrentItemPanel';
import ClassificationPanel from './ClassificationPanel';
import StateMachinePanel from './StateMachinePanel';
import MetricsPanel from './MetricsPanel';
import EventLog from './EventLog';
import ScenarioPanel from './ScenarioPanel';
import SensorPanel from './SensorPanel';
import PidPanel from './PidPanel';
import type { Scenario, ScenarioId, SimulationState } from '../domain/types';

interface DashboardProps {
  simulation: SimulationState;
  scenarios: Scenario[];
  activeScenarioId: ScenarioId;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onScenarioChange: (scenarioId: ScenarioId) => void;
}

export default function Dashboard({
  simulation,
  scenarios,
  activeScenarioId,
  onStart,
  onPause,
  onReset,
  onStep,
  onScenarioChange,
}: DashboardProps) {
  return (
    <div className="app-shell">
      <Header
        simulation={simulation}
        onStart={onStart}
        onPause={onPause}
        onReset={onReset}
        onStep={onStep}
      />
      <main className="dashboard-grid">
        <section className="scene-column panel panel-scene">
          <SorterScene simulation={simulation} />
        </section>
        <aside className="right-rail">
          <CurrentItemPanel simulation={simulation} />
          <ClassificationPanel currentItem={simulation.currentItem} />
          <StateMachinePanel currentState={simulation.machineState} />
          <SensorPanel simulation={simulation} />
        </aside>
        <section className="bottom-row">
          <MetricsPanel metrics={simulation.metrics} />
          <PidPanel pid={simulation.pid} metrics={simulation.metrics} status={simulation.systemStatus} />
          <EventLog events={simulation.events} />
          <ScenarioPanel
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onScenarioChange={onScenarioChange}
          />
        </section>
      </main>
    </div>
  );
}
