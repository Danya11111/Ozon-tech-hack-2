import { OFFICIAL_RULE_LABELS } from '../domain/classifier';
import { NOMINAL_CONVEYOR_SPEED_MPS } from '../domain/simulation';
import type { SimulationState } from '../domain/types';

export default function CurrentProofCard({ simulation }: { simulation: SimulationState }) {
  const current = simulation.currentItem;
  const result = current?.classification;
  const item = current?.item;
  const dimensions = item?.dimensionsMm;
  const lowConfidence = Boolean(item && item.confidence < 0.65);
  const stopped = simulation.machineState === 'FAULT' || simulation.machineState === 'EMERGENCY_STOP';
  const command = simulation.machineState.startsWith('ROUTE_TO_')
    ? simulation.machineState
    : result
      ? `ROUTE_TO_${result.category}`
      : 'WAITING';
  const isCPriority = Boolean(result && !result.dimensionsPass && !result.roundnessPass);

  if (!current) {
    return (
      <div className="proof-card proof-card-empty">
        <div className="proof-card-inner">
          <p className="eyebrow">Ожидание цикла</p>
          <h3>Готово к демонстрации</h3>
          <p>Нажмите Start demo — товар пройдёт Detection → Classification → Command → Routing.</p>
          <p className="proof-limits">
            Limits: {OFFICIAL_RULE_LABELS.boundsSummary} · {OFFICIAL_RULE_LABELS.roundnessDisplay} ·
            conveyor {NOMINAL_CONVEYOR_SPEED_MPS.toFixed(2)} m/s
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`proof-card ${stopped ? 'proof-card-stopped' : ''}`}>
      <div className="proof-card-header">
        <p className="eyebrow">Результат классификации</p>
        <h3>{item?.name}</h3>
      </div>

      <div className="proof-summary">
        <div className="summary-row">
          <span className="summary-label">Category:</span>
          <strong className={`category-${result?.category ?? 'default'}`}>{result?.category ?? '—'}</strong>
        </div>
        <div className="summary-row">
          <span className="summary-label">Command:</span>
          <strong>{command}</strong>
        </div>
        <div className="summary-row">
          <span className="summary-label">Target:</span>
          <strong>{result?.category ? `Zone ${result.category}` : '—'}</strong>
        </div>
        <div className="summary-row">
          <span className="summary-label">Why:</span>
          <em>
            {isCPriority
              ? `dimensions failed, so C has priority even though K = ${item?.roundness.toFixed(2)}`
              : result?.dimensionsPass === false
                ? 'dimensions failed (oversized or undersized)'
                : result?.roundnessPass === false
                  ? `dimensions pass, but K = ${item?.roundness.toFixed(2)} > 0.8`
                  : 'dimensions pass and round section is not detected'}
          </em>
        </div>
      </div>

      <div className="proof-grid">
        <div className="proof-item">
          <span className="proof-label">Dimensions</span>
          <strong className={result?.dimensionsPass === false ? 'fail-text' : 'pass-text'}>
            {result?.dimensionsPass ? 'PASS' : 'FAIL'}
          </strong>
          <em>
            {dimensions?.width}×{dimensions?.depth}×{dimensions?.height} мм
          </em>
        </div>
        <div className="proof-item">
          <span className="proof-label">Roundness K</span>
          <strong className={result?.roundnessPass === false && result?.dimensionsPass ? 'fail-text' : 'pass-text'}>
            {item?.roundness.toFixed(2)}
          </strong>
          <em>{result?.roundnessPass ? 'PASS' : 'DETECTED (>0.8)'}</em>
        </div>
        <div className="proof-item">
          <span className="proof-label">Category</span>
          <strong className={`category-${result?.category ?? 'default'}`}>{result?.category ?? '—'}</strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Target zone</span>
          <strong>{result?.category ? `Zone ${result.category}` : '—'}</strong>
        </div>
        <div className="proof-item proof-item-wide">
          <span className="proof-label">Command</span>
          <strong>{command}</strong>
        </div>
      </div>

      <div className="proof-details">
        <div className="detail-row">
          <span>Official limits</span>
          <strong>
            {OFFICIAL_RULE_LABELS.minDisplay} · {OFFICIAL_RULE_LABELS.maxDisplay}
          </strong>
        </div>
        <div className="detail-row">
          <span>Conveyor target</span>
          <strong>{NOMINAL_CONVEYOR_SPEED_MPS.toFixed(2)} m/s</strong>
        </div>
      </div>

      <div className="proof-reason">
        <strong>Причина решения</strong>
        <p>{result?.reason}</p>
        {isCPriority ? (
          <p className="warning-note">C-priority: негабарит + круглый → только C (габариты важнее формы)</p>
        ) : null}
        {lowConfidence ? (
          <p className="warning-note">Низкая уверенность измерения — rule-based fallback, класс только B/C/D</p>
        ) : null}
        {simulation.machineState === 'FAULT' ? <p className="error-note">FAULT: конвейер остановлен</p> : null}
        {simulation.machineState === 'EMERGENCY_STOP' ? (
          <p className="error-note">EMERGENCY_STOP: аварийная остановка</p>
        ) : null}
        {simulation.metrics.queueLength > 1 ? <p className="warning-note">Очередь товаров</p> : null}
      </div>
    </div>
  );
}
