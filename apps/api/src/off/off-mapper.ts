import type { AllergenCode, DeclaredVeg } from "@foodscanner/shared";
import type { DeclaredAllergens } from "../allergens/allergen-evidence";
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
    image_url: offImageUrl(product.image_front_url),
    quantity: offQuantity(product.quantity),
    declared_allergens: declaredAllergens(product),
    declared_veg: declaredVeg(product),
  };
}

/**
 * The pack's FSSAI symbol, as OFF contributors label it. OFF's own
 * ingredients_analysis "vegetarian" is ignored on purpose: it counts egg as
 * vegetarian, which FSSAI doesn't.
 */
export function declaredVeg(
  product: Pick<OffProduct, "labels_tags">
): DeclaredVeg | null {
  const labels = product.labels_tags ?? [];
  if (labels.includes("en:non-vegetarian")) {
    return "non_veg";
  }
  return labels.includes("en:vegetarian") ? "veg" : null;
}

/** OFF's allergen taxonomy -> our codes; tags we don't check are ignored. */
const OFF_ALLERGEN_TAGS: Record<string, AllergenCode> = {
  "en:peanuts": "peanuts",
  "en:nuts": "tree_nuts",
  "en:milk": "milk",
  "en:gluten": "gluten",
  "en:eggs": "egg",
  "en:fish": "fish",
  "en:crustaceans": "shellfish",
  "en:molluscs": "shellfish",
  "en:soybeans": "soy",
  "en:sesame-seeds": "sesame",
  "en:mustard": "mustard",
  "en:sulphur-dioxide-and-sulphites": "sulphites",
};

/**
 * What OFF says the pack declares. Null when OFF has no allergen data at
 * all — empty lists would claim "declares none", which OFF doesn't know.
 */
export function declaredAllergens(
  product: Pick<OffProduct, "allergens_tags" | "traces_tags">
): DeclaredAllergens | null {
  if (!product.allergens_tags && !product.traces_tags) {
    return null;
  }
  const toCodes = (tags: string[] = []) => [
    ...new Set(tags.flatMap((tag) => OFF_ALLERGEN_TAGS[tag] ?? [])),
  ];
  return {
    contains: toCodes(product.allergens_tags),
    may_contain: toCodes(product.traces_tags),
  };
}

/**
 * OFF is publicly editable and the app loads this URL directly, so only an
 * https image on OFF's own image host is accepted — never a third-party
 * URL (tracking pixels leak users' IPs) or plain http.
 */
export function offImageUrl(raw: string | undefined): string | null {
  try {
    const url = new URL(raw?.trim() ?? "");
    return url.protocol === "https:" &&
      url.hostname === "images.openfoodfacts.org"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const MAX_QUANTITY_LENGTH = 50;

/** Pack size as printed ("1.25 l"); free text, so trimmed and bounded. */
export function offQuantity(raw: string | undefined): string | null {
  const quantity = raw?.trim() ?? "";
  return quantity && quantity.length <= MAX_QUANTITY_LENGTH ? quantity : null;
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

const LIQUID_UNITS = new Set(["ml", "cl", "l"]);
// "500 ml", "1.25 l", "2L", "1 litre" — the number keeps a stray "l" in a
// word from counting.
const LIQUID_QUANTITY = /\d\s*(ml|cl|l|litres?|liters?)\b/i;
// "125 mL / 67 g" (ice cream): could be either basis, so not a clear drink.
const WEIGHT_QUANTITY = /\d\s*(g|kg|grams?)\b/i;

/** Shared with admin/repair-nutrition.ts for stored pack sizes. */
export function isLiquidQuantity(quantity: string | null | undefined): boolean {
  return Boolean(
    quantity &&
    LIQUID_QUANTITY.test(quantity) &&
    !WEIGHT_QUANTITY.test(quantity)
  );
}

export function isLiquidProduct(product: OffProduct): boolean {
  if (product.product_quantity_unit) {
    return LIQUID_UNITS.has(product.product_quantity_unit.toLowerCase());
  }
  if (isLiquidQuantity(product.quantity)) {
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
/** Whether OFF reports this product per 100 g or per 100 ml. */
export type NutritionBasis = "solid" | "liquid";

/** Shared with admin/repair-nutrition.ts for stored data. */
export function isPlausibleGrams(
  nutrient: Nutrient,
  form: NutritionBasis,
  grams: number
): boolean {
  return grams >= 0 && grams <= MAX_GRAMS[nutrient][form];
}

function plausibleGrams(
  value: unknown,
  nutrient: Nutrient,
  form: NutritionBasis
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
  const form: NutritionBasis = isLiquidProduct(product) ? "liquid" : "solid";
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
