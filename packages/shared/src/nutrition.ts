import { z } from "zod";

/**
 * The nutrients FSSAI's Labelling and Display Regulations 2020 make
 * mandatory, in the order labels print them, with the unit each is stored
 * in (`sugar` is total sugars). Values are stored per 100 g or 100 ml as
 * `<nutrient>_per_100g` / `<nutrient>_per_100ml`.
 */
export const LABEL_NUTRIENTS = {
  energy_kcal: "kcal",
  protein: "g",
  carbohydrate: "g",
  sugar: "g",
  added_sugar: "g",
  total_fat: "g",
  saturated_fat: "g",
  trans_fat: "g",
  cholesterol: "mg",
  sodium: "mg",
} as const;

export type NutrientKey = keyof typeof LABEL_NUTRIENTS;
export type NutrientUnit = (typeof LABEL_NUTRIENTS)[NutrientKey];

/** LABEL_NUTRIENTS' keys, in label order. */
export const NUTRIENT_KEYS = Object.keys(LABEL_NUTRIENTS) as NutrientKey[];

/** A label's nutrition as stored ("sugar_per_100g": 3). */
export const nutritionSchema = z.record(
  z.string(),
  z.union([z.number(), z.string(), z.null()])
);
export type Nutrition = z.infer<typeof nutritionSchema>;
