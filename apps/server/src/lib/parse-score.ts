export type ParseScoreOptions = {
  default?: number;
  min?: number;
  max?: number;
  /** When true, parsed value must be strictly greater than min (not equal). */
  exclusiveMin?: boolean;
};

function parseNumericScore(
  raw: string | undefined,
  options: ParseScoreOptions,
): number | null {
  const { default: fallback, min = 0, max = 1000, exclusiveMin = false } =
    options;

  if (!raw?.trim()) {
    if (fallback === undefined) return null;
    return fallback;
  }

  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  if (exclusiveMin ? n <= min : n < min) return null;
  if (n > max) return null;
  return n;
}

/** 客观题分值：空单元格默认 1，须 > 0，上限 1000 */
export function parsePositiveScore(
  raw: string | undefined,
  options?: Omit<ParseScoreOptions, 'exclusiveMin'>,
): number | null {
  return parseNumericScore(raw, {
    default: 1,
    min: 0,
    max: 1000,
    exclusiveMin: true,
    ...options,
  });
}

/** 填空题分值：必填，须 >= 0，上限 1000 */
export function parseNonNegativeScore(raw: string | undefined): number | null {
  return parseNumericScore(raw, { min: 0, max: 1000 });
}
