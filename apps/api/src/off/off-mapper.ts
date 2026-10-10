import { offExtractionConfidence } from "./off-confidence";
import type { OffExtraction, OffProductPayload } from "./off-extraction";

type OffProduct = NonNullable<OffProductPayload["product"]>;

export function mapOffProduct(product: OffProduct): OffExtraction | null {
  const ingredients = ingredientsFromProduct(product);
  if (ingredients.length === 0) {
    return null;
  }

  const confidence = offExtractionConfidence({
    statesTags: product.states_tags ?? [],
    dataQualityErrorsTags: product.data_quality_errors_tags ?? [],
  });

  return {
    name: product.product_name?.trim() || "unknown",
    brand: firstOf(product.brands) || "unknown",
    category: firstOf(product.categories) || "unknown",
    ingredients,
    nutrition: nutritionFromProduct(product),
    nova_group: product.nova_group,
    additive_count: product.additives_n,
    extraction_confidence: confidence,
  };
}

export function ingredientsFromProduct(product: OffProduct): string[] {
  const structured = (product.ingredients ?? [])
    .map((entry) => entry.text?.trim())
    .filter((text): text is string => Boolean(text));
  if (structured.length > 0) {
    return structured;
  }
  const raw = product.ingredients_text ?? "";
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function isLiquidProduct(product: OffProduct): boolean {
  if (product.product_quantity_unit) {
    return product.product_quantity_unit.toLowerCase() === "ml";
  }
  if (product.quantity && /\bml\b/i.test(product.quantity)) {
    return true;
  }
  return (product.categories_tags ?? []).some((tag) =>
    /beverages|drinks|waters/.test(tag)
  );
}

/**
 * The most of each nutrient 100 g/ml of food can physically hold. OFF is
 * community-edited and unit mix-ups are real (mg typed into a grams field):
 * sodium_100g 118 in seed data, and 25 on Coca-Cola India, which made a
 * cola "High salt". A value above its limit is treated as missing — the
 * verdict then says "couldn't check" instead of trusting a wrong number.
 * Physical limits, not "typical" ones, so real outliers (syrups, soy and
 * fish sauce) are never thrown away.
 */
const MAX_GRAMS = {
  sugar: { solid: 100, liquid: 100 },
  // Pure salt is 39.3 g sodium/100 g; saturated brine ~10.5 g/100 ml.
  sodium: { solid: 40, liquid: 12 },
};

export type Nutrient = keyof typeof MAX_GRAMS;
export type ProductForm = "solid" | "liquid";

/** Shared with admin/repair-implausible-nutrition.ts for stored data. */
export function isPlausibleGrams(
  nutrient: Nutrient,
  form: ProductForm,
  grams: number
): boolean {
  return grams >= 0 && grams <= MAX_GRAMS[nutrient][form];
}

function plausibleGrams(
  value: unknown,
  nutrient: Nutrient,
  form: ProductForm
): number | undefined {
  const grams = numberOrUndefined(value);
  return grams !== undefined && isPlausibleGrams(nutrient, form, grams)
    ? grams
    : undefined;
}

/** Only maps the two nutrients the rule engine actually reads (sugar, sodium) — see hld-example-rules.ts. */
export function nutritionFromProduct(
  product: OffProduct
): Record<string, number | string | null> {
  const nutriments = product.nutriments ?? {};
  const form: ProductForm = isLiquidProduct(product) ? "liquid" : "solid";
  const per = form === "liquid" ? "per_100ml" : "per_100g";
  const nutrition: Record<string, number | string | null> = {};

  const sugar = plausibleGrams(nutriments["sugars_100g"], "sugar", form);
  if (sugar !== undefined) {
    nutrition[`sugar_${per}`] = sugar;
  }

  // OFF reports sodium in grams/100g; our rules threshold in mg/100g.
  const sodium = plausibleGrams(nutriments["sodium_100g"], "sodium", form);
  if (sodium !== undefined) {
    nutrition[`sodium_${per}`] = sodium * 1000;
  }

  return nutrition;
}

export function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function firstOf(
  commaSeparated: string | undefined
): string | undefined {
  return commaSeparated?.split(",")[0]?.trim() || undefined;
}
