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

  if (!current) {
    return (
      <div className="proof-card proof-card-empty">
        <div className="proof-card-inner">
          <p className="eyebrow">Ожидание цикла</p>
          <h3>Готово к демонстрации</h3>
          <p>Нажмите Start demo — товар пройдёт Detection → Classification → Command → Routing.</p>
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

      <div className="proof-grid">
        <div className="proof-item">
          <span className="proof-label">Категория</span>
          <strong className={`category-${result?.category ?? 'default'}`}>{result?.category ?? '—'}</strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Зона</span>
          <strong>{result?.category ? `Зона ${result.category}` : '—'}</strong>
        </div>
        <div className="proof-item proof-item-wide">
          <span className="proof-label">Команда</span>
          <strong>{command}</strong>
        </div>
      </div>

      <div className="proof-details">
        <div className="detail-row">
          <span>Габариты</span>
          <strong className={result?.dimensionsPass === false ? 'fail-text' : ''}>
            {dimensions?.width} × {dimensions?.depth} × {dimensions?.height} мм
          </strong>
        </div>
        <div className="detail-row">
          <span>Roundness</span>
          <strong className={result?.roundnessPass === false && result?.dimensionsPass ? 'fail-text' : ''}>
            {item?.roundness.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="proof-reason">
        <strong>Причина решения</strong>
        <p>{result?.reason}</p>
        {lowConfidence ? <p className="warning-note">Низкая уверенность CV — rule-based fallback</p> : null}
        {simulation.machineState === 'FAULT' ? <p className="error-note">FAULT: конвейер остановлен</p> : null}
        {simulation.machineState === 'EMERGENCY_STOP' ? (
          <p className="error-note">EMERGENCY_STOP: аварийная остановка</p>
        ) : null}
        {simulation.metrics.queueLength > 1 ? <p className="warning-note">Очередь товаров</p> : null}
      </div>
    </div>
  );
}
