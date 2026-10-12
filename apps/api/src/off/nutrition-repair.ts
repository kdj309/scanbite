import {
  isLiquidQuantity,
  isPlausibleGrams,
  type Nutrient,
  type NutritionBasis,
} from "./off-mapper";

type Nutrition = Record<string, number | string | null>;

/** Stored nutrition field -> what it measures. Sodium is stored in mg. */
export const NUTRITION_FIELDS: Record<
  string,
  { nutrient: Nutrient; basis: NutritionBasis; toGrams: number }
> = {
  sugar_per_100g: { nutrient: "sugar", basis: "solid", toGrams: 1 },
  sugar_per_100ml: { nutrient: "sugar", basis: "liquid", toGrams: 1 },
  sodium_per_100g: { nutrient: "sodium", basis: "solid", toGrams: 1 / 1000 },
  sodium_per_100ml: { nutrient: "sodium", basis: "liquid", toGrams: 1 / 1000 },
};

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
        isPlausibleGrams(spec.nutrient, spec.basis, value * spec.toGrams)
      );
    })
  );
}
