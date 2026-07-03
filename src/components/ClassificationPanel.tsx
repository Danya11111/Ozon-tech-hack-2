import { DIMENSION_LIMITS } from '../domain/classifier';
import type { SimulatedItem } from '../domain/types';

export default function ClassificationPanel({ currentItem }: { currentItem?: SimulatedItem }) {
  const result = currentItem?.classification;

  return (
    <section className="panel compact-panel">
      <div className="panel-heading">
        <p className="eyebrow">Classification rules</p>
        <h2>Decision tree</h2>
      </div>
      <ol className="decision-tree">
        <li className={result ? (result.dimensionsPass ? 'pass' : 'fail') : ''}>
          dimensions check: {DIMENSION_LIMITS.min.width}-{DIMENSION_LIMITS.max.width} W, {DIMENSION_LIMITS.min.depth}-{DIMENSION_LIMITS.max.depth} D, {DIMENSION_LIMITS.min.height}-{DIMENSION_LIMITS.max.height} H
        </li>
        <li className={result && result.dimensionsPass ? (result.roundnessPass ? 'pass' : 'fail') : ''}>
          roundness check: threshold &lt; {DIMENSION_LIMITS.roundnessThreshold}
        </li>
        <li className={result ? `category-${result.category}` : ''}>
          result: {result ? `${result.category} - ${result.label}` : 'waiting for item'}
        </li>
      </ol>
    </section>
  );
}
