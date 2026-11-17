import type { Nutrient, NutritionBasis } from "./off-mapper";

/** What a stored nutrition field measures, and its factor to grams. */
export type NutritionField = {
  nutrient: Nutrient;
  basis: NutritionBasis;
  toGrams: number;
};
