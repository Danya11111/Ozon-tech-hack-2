import type { SensorState, SimulationState } from '../domain/types';

function SensorRow({ sensor }: { sensor: SensorState }) {
  return (
    <div className={sensor.active ? 'sensor-row active' : 'sensor-row'}>
      <div>
        <strong>{sensor.label}</strong>
        <span>{sensor.lastValue}</span>
      </div>
      <div className="sensor-meta">
        <span>{sensor.latencyMs} ms</span>
        <span>t+{(sensor.lastEventTimestampMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}

export default function SensorPanel({ simulation }: { simulation: SimulationState }) {
  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <p className="eyebrow">Sensors and actuators</p>
        <h2>Live I/O</h2>
      </div>
      <div className="sensor-stack">
        <SensorRow sensor={simulation.sensors.camera} />
        <SensorRow sensor={simulation.sensors.laser} />
        <SensorRow sensor={simulation.sensors.ultrasound} />
      </div>
      <div className="actuator-grid">
        <div><span>Stop-gate</span><strong>{simulation.gate.open ? 'open' : 'closed'}</strong></div>
        <div><span>Pusher C</span><strong>{simulation.actuators.pusherC}</strong></div>
        <div><span>Pusher D</span><strong>{simulation.actuators.pusherD}</strong></div>
      </div>
    </section>
  );
}
