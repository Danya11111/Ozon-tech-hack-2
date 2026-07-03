import type { Metrics, PidState, SystemStatus } from '../domain/types';

interface PidPanelProps {
  pid: PidState;
  metrics: Metrics;
  status: SystemStatus;
}

export default function PidPanel({ pid, status }: PidPanelProps) {
  const fill = Math.min((pid.actualSpeedMps / Math.max(pid.targetSpeedMps, 0.01)) * 100, 100);

  return (
    <section className="panel pid-panel">
      <div className="panel-heading">
        <p className="eyebrow">Conveyor control loop</p>
        <h2>PID imitation</h2>
      </div>
      <div className="pid-bars">
        <div>
          <span>targetSpeedMps</span>
          <strong>{pid.targetSpeedMps.toFixed(2)}</strong>
        </div>
        <div>
          <span>actualSpeedMps</span>
          <strong>{pid.actualSpeedMps.toFixed(2)}</strong>
        </div>
        <div>
          <span>pidError</span>
          <strong>{pid.pidError.toFixed(2)}</strong>
        </div>
        <div>
          <span>correction</span>
          <strong>{pid.correction.toFixed(2)}</strong>
        </div>
      </div>
      <div className="speed-track">
        <div style={{ width: `${fill}%` }} />
      </div>
      <p className="muted">Status {status}: actual speed follows target during flow and decays to zero on jam/emergency.</p>
    </section>
  );
}
