import type { Metrics, PidState, SystemStatus } from '../domain/types';

interface PidPanelProps {
  pid: PidState;
  metrics: Metrics;
  status: SystemStatus;
}

function pidState(pid: PidState, status: SystemStatus): string {
  if (status === 'EMERGENCY_STOP') {
    return 'emergency stop';
  }
  if (status === 'FAULT') {
    return 'stopped by fault';
  }
  if (Math.abs(pid.pidError) <= 0.03 && pid.actualSpeedMps > 0) {
    return 'stable';
  }
  return 'stabilizing';
}

function sparkline(history: number[]): string {
  const values = history.length > 1 ? history : [0, 0];
  const max = Math.max(...values, 0.5);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 220;
      const y = 58 - (value / max) * 48;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function PidPanel({ pid, status }: PidPanelProps) {
  const fill = Math.min((pid.actualSpeedMps / Math.max(pid.targetSpeedMps, 0.01)) * 100, 100);
  const state = pidState(pid, status);

  return (
    <section className="panel pid-panel">
      <div className="panel-heading">
        <p className="eyebrow">Conveyor control loop</p>
        <h2>{state}</h2>
      </div>
      <div className="pid-bars">
        <div><span>target speed</span><strong>{pid.targetSpeedMps.toFixed(2)} m/s</strong></div>
        <div><span>actual speed</span><strong>{pid.actualSpeedMps.toFixed(2)} m/s</strong></div>
        <div><span>error</span><strong>{pid.pidError.toFixed(2)}</strong></div>
        <div><span>correction</span><strong>{pid.correction.toFixed(2)}</strong></div>
      </div>
      <div className="speed-track"><div style={{ width: `${fill}%` }} /></div>
      <svg className="pid-sparkline" viewBox="0 0 220 64" role="img" aria-label="PID speed history">
        <path d="M0 58 H220" />
        <polyline points={sparkline(pid.speedHistoryMps)} />
      </svg>
      <p className="muted">PID shown as simplified control-loop simulation for conveyor speed stabilization.</p>
    </section>
  );
}
