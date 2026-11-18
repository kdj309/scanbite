import {
  NUTRIENT_KEYS,
  type AllergenCode,
  type DeclaredVeg,
  type NutrientKey,
  type Nutrition,
} from "@foodscanner/shared";
import type { DeclaredAllergens } from "../allergens/allergen-evidence";
import type { OffExtraction, OffProduct } from "./off-extraction";
import type {
  NutrientLimit,
  NutrientLimits,
  NutritionBasis,
  OffNutriment,
} from "./off-mapper.types";

export function mapOffProduct(product: OffProduct): OffExtraction | null {
  const ingredients = ingredientsFromProduct(product);
  if (ingredients.length === 0) {
    return null;
  }

  return {
    name: product.product_name?.trim() || "unknown",
    brand: firstOf(product.brands) || "unknown",
    category: offCategory(product),
    ingredients,
    nutrition: nutritionFromProduct(product),
    nova_group: product.nova_group,
    additive_count: product.additives_n,
    image_url: offImageUrl(product.image_front_url),
    quantity: offQuantity(product.quantity),
    declared_allergens: declaredAllergens(product),
    declared_veg: declaredVeg(product),
  };
}

/**
 * OFF's standard food group (pnns_groups_2: "Biscuits and cakes"), the
 * same vocabulary as the imported catalogue, so it lands on a shelf
 * (product-versions/shelves.ts); the contributor's first free-text
 * category only when OFF has no group for it.
 */
function offCategory(product: OffProduct): string {
  const group = product.pnns_groups_2?.trim();
  if (group && group.toLowerCase() !== "unknown") {
    return group;
  }
  return firstOf(product.categories) || "unknown";
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

/** OFF categories for drink mixes sold dry (Glucose-D, milk powder). */
const DRINK_POWDER_TAGS = new Set([
  "en:beverage-preparations",
  "en:dried-products-to-be-rehydrated",
  "en:dehydrated-beverages",
]);

function isWeightOnlyQuantity(quantity: string | undefined): boolean {
  if (!quantity) return false;
  return WEIGHT_QUANTITY.test(quantity) && !LIQUID_QUANTITY.test(quantity);
}

export function isLiquidProduct(product: OffProduct): boolean {
  if (product.product_quantity_unit) {
    return LIQUID_UNITS.has(product.product_quantity_unit.toLowerCase());
  }
  if (isLiquidQuantity(product.quantity)) {
    return true;
  }
  // Sold by weight only ("250 g" of tea): labelled per 100 g, whatever the
  // category. A pack giving both ("1 L (1.04 kg)") is left to the tags.
  if (isWeightOnlyQuantity(product.quantity)) {
    return false;
  }
  const tags = product.categories_tags ?? [];
  // OFF tags every drink with its ancestors, so all of them carry
  // "en:beverages". Not a partial match: "en:plant-based-foods-and-beverages"
  // is a parent of cashews, cereal and chocolate too.
  if (!tags.includes("en:beverages")) return false;
  // Drink powders sit under en:beverages too, but are labelled per 100 g.
  return !tags.some((tag) => DRINK_POWDER_TAGS.has(tag));
}

/**
 * Where OFF keeps each FSSAI label nutrient. OFF normalises every
 * nutrient to grams per 100 g/ml (energy to kcal), whatever unit the
 * contributor typed; cholesterol and sodium are stored in mg.
 */
const OFF_NUTRIMENTS: Record<NutrientKey, OffNutriment> = {
  energy_kcal: { field: "energy-kcal_100g", toStored: 1 },
  protein: { field: "proteins_100g", toStored: 1 },
  carbohydrate: { field: "carbohydrates_100g", toStored: 1 },
  sugar: { field: "sugars_100g", toStored: 1 },
  added_sugar: { field: "added-sugars_100g", toStored: 1 },
  total_fat: { field: "fat_100g", toStored: 1 },
  saturated_fat: { field: "saturated-fat_100g", toStored: 1 },
  trans_fat: { field: "trans-fat_100g", toStored: 1 },
  cholesterol: { field: "cholesterol_100g", toStored: 1000 },
  sodium: { field: "sodium_100g", toStored: 1000 },
};

/** A macronutrient can't be more than all of the food. */
const WHOLE_FOOD: NutrientLimit = { solid: 100, liquid: 100 };

/**
 * The most of each nutrient 100 g/ml of food can physically hold, in OFF's
 * unit. OFF is community-edited and unit mix-ups are real (mg typed into a
 * grams field): sodium_100g 118 in seed data, and 25 on Coca-Cola India,
 * which made a cola "High salt". A value above its limit is treated as
 * missing — the verdict then says "couldn't check" instead of trusting a
 * wrong number. Physical limits, not "typical" ones, so real outliers
 * (syrups, ghee, soy and fish sauce) are never thrown away.
 */
const MAX_PER_100: NutrientLimits = {
  // Pure fat is 900 kcal per 100 g, the most energy food can carry.
  energy_kcal: { solid: 900, liquid: 900 },
  protein: WHOLE_FOOD,
  carbohydrate: WHOLE_FOOD,
  sugar: WHOLE_FOOD,
  added_sugar: WHOLE_FOOD,
  total_fat: WHOLE_FOOD,
  saturated_fat: WHOLE_FOOD,
  trans_fat: WHOLE_FOOD,
  // The richest food, brain, has about 3.1 g per 100 g (USDA).
  cholesterol: { solid: 5, liquid: 5 },
  // Pure salt is 39.3 g sodium/100 g; saturated brine ~10.5 g/100 ml.
  sodium: { solid: 40, liquid: 12 },
};

/** Shared with off/nutrition-repair.ts for stored data. */
export function isPlausibleAmount(
  nutrient: NutrientKey,
  form: NutritionBasis,
  amount: number
): boolean {
  return amount >= 0 && amount <= MAX_PER_100[nutrient][form];
}

function plausibleAmount(
  value: unknown,
  nutrient: NutrientKey,
  form: NutritionBasis
): number | undefined {
  const amount = numberOrUndefined(value);
  if (amount === undefined) return undefined;
  return isPlausibleAmount(nutrient, form, amount) ? amount : undefined;
}

/** Drops float noise from unit conversion (0.11 g -> 110 mg, not 110.00000000000001). */
function tidy(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Every FSSAI label nutrient OFF has a believable value for, per 100 g, or
 * per 100 ml for a drink. Missing and impossible values are left out.
 */
export function nutritionFromProduct(product: OffProduct): Nutrition {
  const nutriments = product.nutriments ?? {};
  const form: NutritionBasis = isLiquidProduct(product) ? "liquid" : "solid";
  const per = form === "liquid" ? "per_100ml" : "per_100g";
  const nutrition: Nutrition = {};
  for (const key of NUTRIENT_KEYS) {
    const { field, toStored } = OFF_NUTRIMENTS[key];
    const amount = plausibleAmount(nutriments[field], key, form);
    if (amount !== undefined) {
      nutrition[`${key}_${per}`] = tidy(amount * toStored);
    }
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
