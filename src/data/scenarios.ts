import { getItem } from './items';
import type { Scenario } from '../domain/types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'normal_flow',
    name: 'Normal flow',
    description: 'Обычный поток из нескольких товаров B/C/D с полным циклом сортировки.',
    goal: 'Показать базовую последовательность sensor -> gate -> classifier -> actuator.',
    expectedCategorySummary: 'Mixed: B, C, D',
    demonstrates: 'Стабильный поток, корректную маршрутизацию и возврат исполнительных механизмов домой.',
    items: ['SKU-001', 'SKU-006', 'SKU-004', 'SKU-003', 'SKU-007'].map(getItem),
  },
  {
    id: 'oversized_item',
    name: 'Oversized item',
    description: 'Товар выходит за max dimensions и должен попасть в roll-cage C.',
    goal: 'Доказать приоритет проверки габаритов.',
    expectedCategorySummary: 'C for every item',
    demonstrates: 'Негабаритный товар фиксируется stop-gate и уводится pusher C в roll-cage C.',
    items: ['SKU-004', 'SKU-005'].map(getItem),
  },
  {
    id: 'round_object',
    name: 'Round object',
    description: 'Габариты проходят, но roundness >= 0.8, маршрут в D.',
    goal: 'Показать проверку круглого сечения после габаритов.',
    expectedCategorySummary: 'D for every item',
    demonstrates: 'Rule-based shape issue routing без реального ML на MVP-этапе.',
    items: ['SKU-006', 'SKU-007', 'SKU-008'].map(getItem),
  },
  {
    id: 'boundary_dimensions',
    name: 'Boundary dimensions',
    description: 'Товары около min/max границ показывают устойчивость правил.',
    goal: 'Проверить строгие границы min/max.',
    expectedCategorySummary: 'Boundary box -> B, Pen -> C',
    demonstrates: '450 x 320 x 320 проходит, width 9 мм не проходит min width.',
    items: ['SKU-010', 'SKU-009', 'SKU-002'].map(getItem),
  },
  {
    id: 'close_items',
    name: 'Close items',
    description: 'Два товара близко друг к другу: warning queue/spacing и последовательная обработка.',
    goal: 'Показать устойчивость очереди без усложнения физики.',
    expectedCategorySummary: 'Sequential B, B, D',
    demonstrates: 'Spacing warning, queue length и обработку товаров по одному циклу.',
    items: ['SKU-001', 'SKU-002', 'SKU-006'].map(getItem),
  },
  {
    id: 'low_confidence',
    name: 'Low confidence',
    description: 'CV confidence ниже 0.65, система предупреждает и принимает rule-based решение.',
    goal: 'Показать fallback при низкой уверенности pseudo-CV.',
    expectedCategorySummary: 'Rule-based B and D despite low CV confidence',
    demonstrates: 'Низкая confidence не блокирует решение, так как финальная логика основана на правилах.',
    items: [
      { ...getItem('SKU-003'), id: 'SKU-003-LC', confidence: 0.58 },
      { ...getItem('SKU-006'), id: 'SKU-006-LC', confidence: 0.61 },
    ],
  },
  {
    id: 'jam',
    name: 'Jam at gate',
    description: 'Застревание у stop-gate переводит систему в FAULT и останавливает конвейер.',
    goal: 'Показать fail-safe состояние при застревании.',
    expectedCategorySummary: 'FAULT before route completion',
    demonstrates: 'Conveyor speed падает к 0, state фиксируется в FAULT, требуется Reset.',
    items: ['SKU-004'].map(getItem),
  },
  {
    id: 'emergency_stop',
    name: 'Emergency stop',
    description: 'Аварийная остановка переводит систему в EMERGENCY_STOP, движение остановлено.',
    goal: 'Показать ручную/аварийную остановку всей линии.',
    expectedCategorySummary: 'EMERGENCY_STOP before route completion',
    demonstrates: 'Все движения останавливаются, PID target становится 0, требуется Reset.',
    items: ['SKU-001', 'SKU-006'].map(getItem),
  },
];

export function getScenario(id: string): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}
