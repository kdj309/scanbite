import { z } from "zod";
import { canonicalCategory } from "../../product-versions/shelves";

type StoredUnit = "mg" | "g" | "kcal";

/**
 * The nutrients FSSAI's Labelling and Display Regulations 2020 make
 * mandatory, with the unit each is stored in (`sugar` is total sugars).
 */
const LABEL_NUTRIENTS = {
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
} as const satisfies Record<string, StoredUnit>;

const nutrientValue = z.union([z.number(), z.string(), z.null()]).optional();

// Printed units, as Indian labels spell them, to the unit they measure.
const UNIT_NAMES: Record<string, string> = {
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  mg: "mg",
  mgs: "mg",
  mcg: "mcg",
  µg: "mcg",
  μg: "mcg",
  kcal: "kcal",
  kcals: "kcal",
  kj: "kj",
};

// How many of the stored unit one printed unit is.
const TO_STORED: Record<StoredUnit, Record<string, number>> = {
  mg: { mg: 1, g: 1000, mcg: 0.001 },
  g: { g: 1, mg: 0.001 },
  kcal: { kcal: 1, kj: 1 / 4.184 },
};

const PRINTED =
  /^(?:<|≤|less than|upto|up to)?\s*(\d+(?:\.\d+)?)\s*([a-zµμ]*)\.?$/;

/**
 * A value as the label prints it ("17.47 g", "<0.1 g", "0.48 g" of sodium)
 * in the unit we store. The model copies the text and the code converts:
 * asked to convert itself, it skipped sodium printed in grams and misread
 * "0.1g" as 0.19. A limit ("<0.1 g") counts as that number. Indian labels
 * print "NIL" for none (FSSAI wording): stored as 0 so the rules can use
 * it. Anything else stays text, which reads as "not on the label".
 */
function toStoredUnit(
  value: number | string | null,
  unit: StoredUnit
): number | string | null {
  if (typeof value !== "string") {
    return value;
  }
  const text = value
    .toLowerCase()
    // Footnote marks ("0 g*") and thousands separators ("2,092 kJ").
    .replace(/\*/g, "")
    .replace(/(\d),(\d{3})\b/g, "$1$2")
    .trim();
  if (/^nil\b/.test(text)) {
    return 0;
  }
  const match = PRINTED.exec(text);
  if (!match) {
    return value;
  }
  const factor = match[2] ? TO_STORED[unit][UNIT_NAMES[match[2]] ?? ""] : 1;
  if (factor === undefined) {
    return value;
  }
  return Math.round(Number(match[1]) * factor * 1000) / 1000;
}

// Each key the model may send, with the unit it's stored in.
const UNIT_BY_KEY = new Map<string, StoredUnit>(
  Object.entries(LABEL_NUTRIENTS).flatMap(([nutrient, unit]) => [
    [`${nutrient}_per_100g`, unit],
    [`${nutrient}_per_100ml`, unit],
  ])
);
const NUTRITION_KEYS = [...UNIT_BY_KEY.keys()];

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
  .transform((nutrition) =>
    Object.fromEntries(
      Object.entries(nutrition as Record<string, number | string | null>).map(
        ([key, value]) => [key, toStoredUnit(value, UNIT_BY_KEY.get(key)!)]
      )
    )
  );

export const extractionOutputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  // A shelf name, or on the dessert shelf "Ice cream" / "Dairy desserts"
  // (their WHO limits differ), as asked; anything else can't be compared,
  // so it's stored as not known rather than as a category nobody else has.
  category: z
    .string()
    .min(1)
    .transform((category): string => canonicalCategory(category) ?? "unknown"),
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
