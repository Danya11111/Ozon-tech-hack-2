import { DIMENSION_LIMITS, OFFICIAL_RULE_LABELS } from '../domain/classifier';
import type { SimulationState } from '../domain/types';

function Verdict({ pass, skipped = false }: { pass?: boolean; skipped?: boolean }) {
  if (skipped) {
    return <span className="verdict skipped">SKIPPED</span>;
  }
  if (pass === undefined) {
    return <span className="verdict pending">PENDING</span>;
  }
  return <span className={pass ? 'verdict pass' : 'verdict fail'}>{pass ? 'PASS' : 'FAIL'}</span>;
}

export default function ClassificationPanel({ simulation }: { simulation: SimulationState }) {
  const current = simulation.currentItem;
  const result = current?.classification;
  const item = current?.item;
  const dimensions = item?.dimensionsMm;
  const isOversizedAndRound = Boolean(result && !result.dimensionsPass && !result.roundnessPass);
  const lowConfidence = Boolean(item && item.confidence < 0.65);

  return (
    <section className="panel compact-panel classification-panel">
      <div className="panel-heading">
        <p className="eyebrow">Classification rules</p>
        <h2>Decision proof</h2>
      </div>
      <div className="rule-stack">
        <div className="rule-card">
          <div><strong>Step 1: Dimensions check</strong><Verdict pass={result?.dimensionsPass} /></div>
          <p>Allowed: {OFFICIAL_RULE_LABELS.boundsSummary} (exclusive official bounds).</p>
          <p>Actual: {dimensions ? `${dimensions.width} x ${dimensions.depth} x ${dimensions.height} mm` : 'waiting for item'}</p>
        </div>
        <div className="rule-card">
          <div><strong>Step 2: Roundness check</strong><Verdict pass={result?.roundnessPass} skipped={result ? !result.dimensionsPass : false} /></div>
          <p>Roundness for D: {OFFICIAL_RULE_LABELS.roundnessDisplay} (threshold {DIMENSION_LIMITS.roundnessThreshold}).</p>
          <p>Actual roundness: {item ? item.roundness.toFixed(2) : 'waiting for item'}</p>
        </div>
        <div className="rule-card">
          <div><strong>Step 3: Category decision</strong><span className={result ? `decision-badge category-${result.category}` : 'decision-badge'}>{result ? result.category : '-'}</span></div>
          <p>{result ? result.reason : 'Run a scenario to classify the current item.'}</p>
          {isOversizedAndRound ? <p className="warning-note">Приоритет: C, потому что габариты проверяются первыми.</p> : null}
          {lowConfidence ? <p className="warning-note">CV confidence низкий, решение подтверждено rule-based fallback.</p> : null}
        </div>
      </div>
    </section>
  );
}
