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
      <div className="proof-card proof-card-empty">
        <div className="proof-card-inner">
          <p className="eyebrow">Awaiting cycle</p>
          <h3>Ready to demonstrate sorting cycle</h3>
          <p>Нажмите «Запустить демо» для начала или переключите сценарий ниже.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`proof-card ${stopped ? 'proof-card-stopped' : ''}`}>
      <div className="proof-card-header">
        <p className="eyebrow">Результат классификации</p>
        <h3>{item?.name} (ID: {item?.id})</h3>
      </div>
      
      <div className="proof-grid">
        <div className="proof-item">
          <span className="proof-label">Категория</span>
          <strong className={`category-${result?.category || 'default'}`}>{result?.category || '-'}</strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Маршрут</span>
          <strong>{result?.category ? `Зона ${result.category}` : '-'}</strong>
        </div>
        <div className="proof-item">
          <span className="proof-label">Команда</span>
          <strong>{simulation.machineState.startsWith('ROUTE_TO_') ? simulation.machineState : 'WAITING'}</strong>
        </div>
      </div>

      <div className="proof-details">
        <div className="detail-row">
          <span>Габариты:</span>
          <strong className={result?.dimensionsPass === false ? 'fail-text' : ''}>
            {dimensions?.width} x {dimensions?.depth} x {dimensions?.height} мм
          </strong>
        </div>
        <div className="detail-row">
          <span>Roundness:</span>
          <strong className={result?.roundnessPass === false && result?.dimensionsPass ? 'fail-text' : ''}>
            {item?.roundness.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="proof-reason">
        <strong>Почему такое решение:</strong> {result?.reason}
        {lowConfidence && <p className="warning-note">Низкая уверенность CV — использован rule-based fallback</p>}
        {simulation.machineState === 'FAULT' && <p className="error-note">FAULT: Конвейер остановлен</p>}
        {simulation.machineState === 'EMERGENCY_STOP' && <p className="error-note">EMERGENCY_STOP: Аварийная остановка</p>}
        {simulation.metrics.queueLength > 1 && <p className="warning-note">Внимание: очередь товаров</p>}
      </div>
    </div>
  );
}