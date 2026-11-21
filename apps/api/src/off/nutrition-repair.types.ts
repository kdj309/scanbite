import type { NutrientKey } from "@foodscanner/shared";
import type { NutritionBasis } from "./off-mapper.types";

/** What a stored nutrition field measures, and its factor to OFF's unit. */
export type NutritionField = {
  nutrient: NutrientKey;
  basis: NutritionBasis;
  toOffUnit: number;
};
