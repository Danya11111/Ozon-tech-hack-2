import { DIMENSION_LIMITS } from '../domain/classifier';
import type { SimulationState } from '../domain/types';

export default function CurrentProofCard({ simulation }: { simulation: SimulationState }) {
  const current = simulation.currentItem;
  const result = current?.classification;
  const item = current?.item;
  const dimensions = item?.dimensionsMm;
  const lowConfidence = Boolean(item && item.confidence < 0.65);
  const stopped = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';

  if (!current) {
    return (
      <section className="proof-card proof-card-empty">
        <div className="proof-card-inner">
          <p className="eyebrow">Awaiting cycle</p>
          <h2>Ready to demonstrate sorting cycle</h2>
          <p>The demo will show detection, classification, control command and routing to B/C/D.</p>
          <div className="evidence-chain empty-chain">
            <span>Detection</span>
            <span className="arrow">→</span>
            <span>Classification</span>
            <span className="arrow">→</span>
            <span>Command</span>
            <span className="arrow">→</span>
            <span>Actuator</span>
            <span className="arrow">→</span>
            <span>Route</span>
            <span className="arrow">→</span>
            <span>Log</span>
          </div>
          <p className="start-prompt">Click <strong>Start Guided Demo</strong> or Next to begin.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`proof-card ${stopped ? 'proof-card-stopped' : ''}`}>
      <div className="panel-heading">
        <p className="eyebrow">Current Item Proof</p>
        <h2>{item?.name} (ID: {item?.id})</h2>
      </div>
      <div className="proof-grid">
        <div className="proof-item">
          <span className="proof-label">Dimensions</span>
          <strong className={result?.dimensionsPass === false ? 'fail-text' : ''}>
            {dimensions?.width} x {dimensions?.depth} x {dimensions?.height} mm
          </strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Roundness</span>
          <strong className={result?.roundnessPass === false && result?.dimensionsPass ? 'fail-text' : ''}>
            {item?.roundness.toFixed(2)}
          </strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Confidence</span>
          <strong className={lowConfidence ? 'warn-text' : ''}>
            {(item?.confidence ?? 0 * 100).toFixed(0)}%
          </strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Category</span>
          <strong className={`category-${result?.category}`}>{result?.category}</strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Command</span>
          <strong>{simulation.machineState.startsWith('ROUTE_TO_') ? simulation.machineState : 'WAITING'}</strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Target zone</span>
          <strong>{result?.category ? `Zone ${result.category}` : '-'}</strong>
        </div>
      </div>
      <div className="proof-reason">
        <strong>Decision reason:</strong> {result?.reason}
        {lowConfidence && <p className="warning-note">Low CV confidence — rule-based fallback used</p>}
        {simulation.machineState === 'FAULT' && <p className="error-note">FAULT: Conveyor stopped, reset required</p>}
        {simulation.machineState === 'EMERGENCY_STOP' && <p className="error-note">EMERGENCY_STOP: All actuators stopped</p>}
        {simulation.metrics.queueLength > 1 && <p className="warning-note">Spacing warning: sequential processing enforced</p>}
      </div>
      <div className="evidence-chain active-chain">
        <span className={simulation.machineState === 'DETECTING' ? 'active-step' : 'done-step'}>Detection</span>
        <span className="arrow">→</span>
        <span className={simulation.machineState === 'CLASSIFYING' ? 'active-step' : (result ? 'done-step' : '')}>Classification</span>
        <span className="arrow">→</span>
        <span className={simulation.machineState.startsWith('ROUTE_TO_') ? 'active-step' : (result ? 'done-step' : '')}>Command</span>
        <span className="arrow">→</span>
        <span className={simulation.actuators.pusherC !== 'idle' || simulation.actuators.pusherD !== 'idle' ? 'active-step' : (result ? 'done-step' : '')}>Actuator</span>
        <span className="arrow">→</span>
        <span className={simulation.machineState.startsWith('ROUTE_TO_') ? 'active-step' : ''}>Route</span>
        <span className="arrow">→</span>
        <span className={simulation.machineState === 'RETURN_HOME' ? 'active-step' : ''}>Log</span>
      </div>
    </section>
  );
}