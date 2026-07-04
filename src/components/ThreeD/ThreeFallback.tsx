import SorterScene from '../SorterScene';
import type { SimulationState } from '../../domain/types';

interface Props {
  simulation: SimulationState;
  reason?: 'webgl' | 'user' | 'mobile';
}

const MESSAGES: Record<NonNullable<Props['reason']>, string> = {
  webgl: '3D недоступен (WebGL), включён 2D fallback. Логика симуляции та же.',
  user: 'Включён 2D fallback. Логика симуляции та же.',
  mobile: 'На узком экране включён 2D fallback. Логика симуляции та же.',
};

export default function ThreeFallback({ simulation, reason = 'user' }: Props) {
  return (
    <div className="three-fallback">
      <p className="three-fallback-note" role="status">
        {MESSAGES[reason]}
      </p>
      <SorterScene simulation={simulation} variant="simple" />
    </div>
  );
}
