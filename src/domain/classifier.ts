import type { Category, CategoryDefinition, ClassificationResult, Item } from './types';

export const CATEGORY_DEFINITIONS: Record<Category, CategoryDefinition> = {
  B: {
    label: 'Основной сортировщик',
    reason: 'Габариты подходят, круговое сечение не обнаружено',
  },
  C: {
    label: 'Неправильные габариты',
    reason: 'Нарушены допустимые габариты',
  },
  D: {
    label: 'Неправильная форма / доупаковка',
    reason: 'Обнаружен признак круглого сечения',
  },
};

export const DIMENSION_LIMITS = {
  min: { width: 10, depth: 10, height: 10 },
  max: { width: 450, depth: 320, height: 320 },
  roundnessThreshold: 0.8,
};

export function classifyItem(item: Item): ClassificationResult {
  const { width, depth, height } = item.dimensionsMm;
  const dimensionsPass =
    width >= DIMENSION_LIMITS.min.width &&
    depth >= DIMENSION_LIMITS.min.depth &&
    height >= DIMENSION_LIMITS.min.height &&
    width <= DIMENSION_LIMITS.max.width &&
    depth <= DIMENSION_LIMITS.max.depth &&
    height <= DIMENSION_LIMITS.max.height;

  const roundnessPass = item.roundness < DIMENSION_LIMITS.roundnessThreshold;
  const warnings: string[] = [];

  if (item.confidence < 0.65) {
    warnings.push('CV confidence ниже 0.65, решение принято rule-based способом');
  }

  const category: Category = !dimensionsPass ? 'C' : roundnessPass ? 'B' : 'D';
  const definition = CATEGORY_DEFINITIONS[category];

  return {
    category,
    label: definition.label,
    reason: definition.reason,
    dimensionsPass,
    roundnessPass,
    warnings,
  };
}
