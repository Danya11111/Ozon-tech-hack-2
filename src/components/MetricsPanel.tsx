import type { Metrics } from '../domain/types';

const metricLabels: Array<[keyof Metrics, string, string]> = [
  ['processedCount', 'Processed', 'items'],
  ['successCount', 'Success', 'items'],
  ['errorCount', 'Errors', 'items'],
  ['avgCycleTimeMs', 'Avg cycle', 'ms'],
  ['throughputItemsPerMin', 'Throughput', 'items/min'],
  ['cvLatencyMs', 'CV latency', 'ms'],
  ['actuatorLatencyMs', 'Actuator latency', 'ms'],
  ['queueLength', 'Queue length', 'items'],
  ['queueDelayMs', 'Queue delay', 'ms'],
  ['conveyorSpeedMps', 'Conveyor speed', 'm/s'],
  ['pidTargetSpeedMps', 'PID target', 'm/s'],
  ['pidActualSpeedMps', 'PID actual', 'm/s'],
];

export default function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <section className="panel metrics-panel">
      <div className="panel-heading">
        <p className="eyebrow">Metrics</p>
        <h2>Line telemetry</h2>
      </div>
      <div className="metric-grid">
        {metricLabels.map(([key, label, unit]) => (
          <div className="metric-card" key={key}>
            <span>{label}</span>
            <strong>{metrics[key]}</strong>
            <em>{unit}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
