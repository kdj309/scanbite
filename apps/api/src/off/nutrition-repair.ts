import {
  LABEL_NUTRIENTS,
  NUTRIENT_KEYS,
  type Nutrition,
} from "@foodscanner/shared";
import { isLiquidQuantity, isPlausibleAmount } from "./off-mapper";
import type { NutritionField } from "./nutrition-repair.types";

/**
 * Stored nutrition field -> what it measures, and the factor back to OFF's
 * unit for the plausibility check (stored mg -> g; g and kcal as they are).
 */
export const NUTRITION_FIELDS: Record<string, NutritionField> =
  Object.fromEntries(
    NUTRIENT_KEYS.flatMap((nutrient) => {
      const toOffUnit = LABEL_NUTRIENTS[nutrient] === "mg" ? 1 / 1000 : 1;
      return [
        [`${nutrient}_per_100g`, { nutrient, basis: "solid", toOffUnit }],
        [`${nutrient}_per_100ml`, { nutrient, basis: "liquid", toOffUnit }],
      ];
    })
  );

/**
 * Applies today's import checks to nutrition stored before they existed
 * (used by admin/repair-nutrition.ts):
 *  1. a drink (pack size in ml/l) stored under *_per_100g keys gets
 *     *_per_100ml keys — OFF reports drinks per 100 ml, so only the keys
 *     were wrong;
 *  2. values 100 g/ml can't physically hold are dropped.
 * Returns the input unchanged when nothing applies.
 */
export function repairNutrition(
  nutrition: Nutrition,
  quantity: string | null | undefined
): Nutrition {
  return withoutImpossible(asDrink(nutrition, quantity));
}

function asDrink(
  nutrition: Nutrition,
  quantity: string | null | undefined
): Nutrition {
  const storedAsSolid = Object.keys(nutrition).some((key) =>
    key.endsWith("_per_100g")
  );
  if (!isLiquidQuantity(quantity) || !storedAsSolid) {
    return nutrition;
  }
  return Object.fromEntries(
    Object.entries(nutrition).map(([key, value]) => [
      key.replace(/_per_100g$/, "_per_100ml"),
      value,
    ])
  );
}

function withoutImpossible(nutrition: Nutrition): Nutrition {
  return Object.fromEntries(
    Object.entries(nutrition).filter(([key, value]) => {
      const spec = NUTRITION_FIELDS[key];
      return (
        !spec ||
        typeof value !== "number" ||
        isPlausibleAmount(spec.nutrient, spec.basis, value * spec.toOffUnit)
      );
    })
  );
}
