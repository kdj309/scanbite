import type { NutrientKey } from "@foodscanner/shared";

/** Whether OFF reports a product per 100 g or per 100 ml. */
export type NutritionBasis = "solid" | "liquid";

/** Where OFF keeps a label nutrient, and how to store it. */
export type OffNutriment = {
  /** OFF's normalised field: grams per 100 g/ml (kcal for energy). */
  field: string;
  /** OFF's unit to ours: 1000 for the nutrients we store in mg. */
  toStored: number;
};

/** The most of a nutrient 100 g or 100 ml can hold, in OFF's unit. */
export type NutrientLimit = Record<NutritionBasis, number>;

export type NutrientLimits = Record<NutrientKey, NutrientLimit>;
