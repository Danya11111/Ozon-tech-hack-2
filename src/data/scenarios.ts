import { getItem } from './items';
import type { Scenario } from '../domain/types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'normal_flow',
    name: 'Normal flow',
    description: 'Обычный поток из нескольких товаров B/C/D с полным циклом сортировки.',
    items: ['SKU-001', 'SKU-006', 'SKU-004', 'SKU-003', 'SKU-007'].map(getItem),
  },
  {
    id: 'oversized_item',
    name: 'Oversized item',
    description: 'Товар выходит за max dimensions и должен попасть в roll-cage C.',
    items: ['SKU-004', 'SKU-005'].map(getItem),
  },
  {
    id: 'round_object',
    name: 'Round object',
    description: 'Габариты проходят, но roundness >= 0.8, маршрут в D.',
    items: ['SKU-006', 'SKU-007', 'SKU-008'].map(getItem),
  },
  {
    id: 'boundary_dimensions',
    name: 'Boundary dimensions',
    description: 'Товары около min/max границ показывают устойчивость правил.',
    items: ['SKU-010', 'SKU-009', 'SKU-002'].map(getItem),
  },
  {
    id: 'close_items',
    name: 'Close items',
    description: 'Два товара близко друг к другу: warning queue/spacing и последовательная обработка.',
    items: ['SKU-001', 'SKU-002', 'SKU-006'].map(getItem),
  },
  {
    id: 'low_confidence',
    name: 'Low confidence',
    description: 'CV confidence ниже 0.65, система предупреждает и принимает rule-based решение.',
    items: [
      { ...getItem('SKU-003'), id: 'SKU-003-LC', confidence: 0.58 },
      { ...getItem('SKU-006'), id: 'SKU-006-LC', confidence: 0.61 },
    ],
  },
  {
    id: 'jam',
    name: 'Jam at gate',
    description: 'Застревание у stop-gate переводит систему в FAULT и останавливает конвейер.',
    items: ['SKU-004'].map(getItem),
  },
  {
    id: 'emergency_stop',
    name: 'Emergency stop',
    description: 'Аварийная остановка переводит систему в EMERGENCY_STOP, движение остановлено.',
    items: ['SKU-001', 'SKU-006'].map(getItem),
  },
];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}
