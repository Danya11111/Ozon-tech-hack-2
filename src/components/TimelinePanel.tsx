import { buildCycleTimeline } from '../domain/simulation';
import type { SimulationState } from '../domain/types';

function formatMs(ms?: number): string {
  return ms === undefined ? '-' : `t+${(ms / 1000).toFixed(1)}s`;
}

export default function TimelinePanel({ simulation }: { simulation: SimulationState }) {
  const timeline = buildCycleTimeline(simulation);
  const current = simulation.currentItem;
  const totalCycleTime = current ? simulation.simTimeMs - current.startedAtMs : 0;

  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <p className="eyebrow">Cycle timeline</p>
        <h2>{current ? current.item.id : 'No active cycle'}</h2>
      </div>
      <div className="timeline-summary">
        <div><span>total cycle</span><strong>{totalCycleTime} ms</strong></div>
        <div><span>cv latency</span><strong>{simulation.metrics.cvLatencyMs} ms</strong></div>
        <div><span>actuator latency</span><strong>{simulation.metrics.actuatorLatencyMs} ms</strong></div>
        <div><span>conveyor</span><strong>{simulation.metrics.conveyorSpeedMps.toFixed(2)} m/s</strong></div>
        <div><span>queue delay</span><strong>{simulation.metrics.queueDelayMs} ms</strong></div>
      </div>
      <div className="timeline-list">
        {timeline.map((entry) => (
          <div className={`timeline-row ${entry.status}`} key={entry.state}>
            <span className="timeline-dot" />
            <strong>{entry.state}</strong>
            <span>{formatMs(entry.startedAtMs)}</span>
            <span>{entry.durationMs} ms</span>
            <em>{entry.status}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
