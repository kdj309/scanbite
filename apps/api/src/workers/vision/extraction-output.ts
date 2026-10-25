import { z } from "zod";

/**
 * The nutrients FSSAI's Labelling and Display Regulations 2020 make
 * mandatory, as stored (`sugar` is total sugars). Sodium and cholesterol
 * are in mg, energy in kcal, the rest in g.
 */
const LABEL_NUTRIENTS = [
  "energy_kcal",
  "protein",
  "carbohydrate",
  "sugar",
  "added_sugar",
  "total_fat",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
] as const;

// Indian labels print "NIL" for none (FSSAI wording). Stored as 0 so the
// rules can use it; as text it read as "not on the label".
const nutrientValue = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) =>
    typeof value === "string" && value.trim().toLowerCase() === "nil"
      ? 0
      : value
  )
  .optional();

const NUTRITION_KEYS = LABEL_NUTRIENTS.flatMap((nutrient) => [
  `${nutrient}_per_100g`,
  `${nutrient}_per_100ml`,
]);

/**
 * Keys outside the list (fibre is common on Indian labels) are dropped,
 * not a failed read; the caller logs them so a renamed one (say
 * "sodium_mg_per_100g", which reads as "Couldn't check salt") shows up.
 */
export function unlistedNutritionKeys(nutrition: unknown): string[] {
  if (typeof nutrition !== "object" || nutrition === null) {
    return [];
  }
  return Object.keys(nutrition).filter((key) => !NUTRITION_KEYS.includes(key));
}

const nutritionSchema = z
  .object(Object.fromEntries(NUTRITION_KEYS.map((key) => [key, nutrientValue])))
  // Missing nutrients are left out, never set to undefined.
  .transform(
    (nutrition) => nutrition as Record<string, number | string | null>
  );

export const extractionOutputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  ingredients: z.array(z.string()),
  nutrition: nutritionSchema,
  // The prompt allows null ("can't tell the processing level"): read it as
  // not known, like a missing field, instead of rejecting the whole label.
  nova_group: z
    .number()
    .nullish()
    .transform((group) => group ?? undefined),
  additive_count: z.number().optional(),
  extraction_confidence: z.number().min(0).max(1),
  /**
   * Whether the supplied photos all appear to be the same product's
   * packaging. "inconsistent" forces needs_review regardless of
   * extraction_confidence — a confidently-extracted merge of two different
   * products is worse than an honest low-confidence read of one.
   */
  photo_consistency: z.enum(["consistent", "inconsistent"]),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
