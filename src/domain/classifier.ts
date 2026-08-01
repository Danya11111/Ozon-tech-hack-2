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

/**
 * Official Track 3 sorter limits (doc-1783095831 pp.5–7).
 * Bounds are exclusive: dimensions must be strictly greater than min
 * and strictly less than max («больше» / «меньше»).
 * Round cross-section when K > roundnessThreshold (K = 0.8 is NOT round).
 */
export const DIMENSION_LIMITS = {
  min: { width: 10, depth: 10, height: 10 },
  max: { width: 450, depth: 320, height: 320 },
  roundnessThreshold: 0.8,
} as const;

/** Public-facing labels for UI / demo / docs. */
export const OFFICIAL_RULE_LABELS = {
  minDisplay: '> 10×10×10 мм',
  maxDisplay: '< 450×320×320 мм',
  roundnessDisplay: 'K > 0.8',
  boundsSummary: '> 10×10×10 и < 450×320×320 мм',
} as const;

export function dimensionsPassOfficial(dimensionsMm: {
  width: number;
  depth: number;
  height: number;
}): boolean {
  const { width, depth, height } = dimensionsMm;
  return (
    width > DIMENSION_LIMITS.min.width &&
    depth > DIMENSION_LIMITS.min.depth &&
    height > DIMENSION_LIMITS.min.height &&
    width < DIMENSION_LIMITS.max.width &&
    depth < DIMENSION_LIMITS.max.depth &&
    height < DIMENSION_LIMITS.max.height
  );
}

/** Official figure: circular cross-section iff K > 0.8. */
export function isCircularCrossSection(roundnessK: number): boolean {
  return roundnessK > DIMENSION_LIMITS.roundnessThreshold;
}

export function classifyItem(item: Item): ClassificationResult {
  const dimensionsPass = dimensionsPassOfficial(item.dimensionsMm);
  // roundnessPass = shape OK for category B (not circular)
  const roundnessPass = !isCircularCrossSection(item.roundness);
  const warnings: string[] = [];

  if (item.confidence < 0.65) {
    warnings.push('Measurement confidence ниже 0.65, решение принято rule-based способом');
  }

  // Order: dimensions → C; else circular → D; else B. C priority over D.
  const category: Category = !dimensionsPass ? 'C' : isCircularCrossSection(item.roundness) ? 'D' : 'B';
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
