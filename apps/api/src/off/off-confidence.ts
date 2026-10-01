const INGREDIENTS_COMPLETED = "en:ingredients-completed";
const NUTRITION_COMPLETED = "en:nutrition-facts-completed";

/** Floor applied when data-quality errors are flagged, however complete the entry otherwise looks. */
const DATA_QUALITY_ERROR_FLOOR = 0.2;
const DATA_QUALITY_ERROR_PENALTY = 0.25;

/**
 * OFF is community-edited — "has ingredients_text" alone doesn't mean the
 * entry is trustworthy. Scale confidence by OFF's own completeness/quality
 * signals instead of a flat value, so a thin or flagged-bad entry still
 * goes through normal consensus/needs_review rather than auto-promoting on
 * the strength of OFF's name alone.
 */
export function offExtractionConfidence(input: {
  statesTags: string[];
  dataQualityErrorsTags: string[];
}): number {
  const hasIngredientsCompleted = input.statesTags.includes(
    INGREDIENTS_COMPLETED
  );
  const hasNutritionCompleted = input.statesTags.includes(NUTRITION_COMPLETED);

  let confidence: number;
  if (hasIngredientsCompleted && hasNutritionCompleted) {
    confidence = 0.9;
  } else if (hasIngredientsCompleted) {
    confidence = 0.75;
  } else {
    confidence = 0.55;
  }

  if (input.dataQualityErrorsTags.length > 0) {
    confidence = Math.max(
      DATA_QUALITY_ERROR_FLOOR,
      confidence - DATA_QUALITY_ERROR_PENALTY
    );
  }

  // Round off float noise (e.g. 0.55 - 0.25) before this is stored/displayed.
  return Math.round(confidence * 100) / 100;
}
