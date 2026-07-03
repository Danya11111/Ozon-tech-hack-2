import type { SimulationState } from '../domain/types';

export default function CurrentItemPanel({ simulation }: { simulation: SimulationState }) {
  const current = simulation.currentItem;

  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <p className="eyebrow">Current item</p>
        <h2>{current?.item.id ?? 'No active item'}</h2>
      </div>
      {current ? (
        <div className="kv-grid">
          <span>Name</span><strong>{current.item.name}</strong>
          <span>Dimensions</span><strong>{current.item.dimensionsMm.width} x {current.item.dimensionsMm.depth} x {current.item.dimensionsMm.height} mm</strong>
          <span>Height</span><strong>{current.item.dimensionsMm.height} mm</strong>
          <span>Roundness</span><strong>{current.item.roundness.toFixed(2)}</strong>
          <span>Confidence</span><strong>{Math.round(current.item.confidence * 100)}%</strong>
          <span>Category</span><strong className={`category-${current.classification.category}`}>{current.classification.category} / {current.classification.label}</strong>
          <span>Reason</span><strong>{current.classification.reason}</strong>
        </div>
      ) : (
        <p className="muted">Start or step the simulation to feed an item into zone A.</p>
      )}
    </section>
  );
}
