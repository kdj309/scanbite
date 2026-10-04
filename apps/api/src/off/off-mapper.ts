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

/** Only maps the two nutrients the rule engine actually reads (sugar, sodium) — see hld-example-rules.ts. */
/**
 * A gram quantity "per 100g" can never physically exceed 100 — you can't
 * have more than 100g of any one component in 100g of product. OFF is
 * community-edited and this bound catches real unit mix-ups (e.g. a
 * contributor entering milligrams into a field documented as grams), not
 * just hypothetical bad input — found via a sodium_100g value of 118 in
 * real seed data, which is impossible as grams but unremarkable as mg.
 * Treated as missing rather than clamped, so it flows through the
 * existing "missing data" handling instead of silently using a wrong
 * number.
 */
const MAX_GRAMS_PER_100G = 100;

function validGramsPer100g(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value >= 0 && value <= MAX_GRAMS_PER_100G ? value : undefined;
}

export function nutritionFromProduct(
  product: OffProduct
): Record<string, number | string | null> {
  const nutriments = product.nutriments ?? {};
  const liquid = isLiquidProduct(product);
  const nutrition: Record<string, number | string | null> = {};

  const sugar = validGramsPer100g(numberOrUndefined(nutriments["sugars_100g"]));
  if (sugar !== undefined) {
    nutrition[liquid ? "sugar_per_100ml" : "sugar_per_100g"] = sugar;
  }

  // OFF reports sodium in grams/100g; our rules threshold in mg/100g.
  const sodiumGrams = validGramsPer100g(
    numberOrUndefined(nutriments["sodium_100g"])
  );
  if (sodiumGrams !== undefined) {
    nutrition[liquid ? "sodium_per_100ml" : "sodium_per_100g"] =
      sodiumGrams * 1000;
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
