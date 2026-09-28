import { Types } from "mongoose";
import type { ProductVersion } from "../database/schemas/product-version.schema";

/**
 * OFF reports liquids per 100ml and solids per 100g — that reporting basis
 * is itself the signal for which kind of product this is. Keyed on sugar
 * specifically (our primary/most-populated nutrient), not "any *_per_100ml
 * key" — some OFF entries mix bases per nutrient (e.g. a dairy product with
 * sugar reported per 100g but sodium per 100ml), and classifying the whole
 * product as "liquid" off an unrelated nutrient's basis would wrongly skip
 * a perfectly valid solid sugar check.
 */
function productFormFromNutrition(
  nutrition: Record<string, number | string | null>
): "solid" | "liquid" {
  return nutrition.sugar_per_100ml !== undefined ? "liquid" : "solid";
}

export function factsFromVersion(
  version: ProductVersion,
  ingredientCategories: string[]
): Record<string, unknown> {
  const nutrition = version.nutrition ?? {};
  return {
    ...nutrition,
    sugar_per_100g: nutrition.sugar_per_100g,
    additive_count: version.additive_count ?? nutrition.additive_count,
    nova_group: version.nova_group ?? nutrition.nova_group,
    ingredient_category: ingredientCategories,
    product_form: productFormFromNutrition(nutrition),
  };
}

export function unresolvedIngredientNames(
  version: Pick<ProductVersion, "ingredients">
): string[] {
  return version.ingredients
    .filter((ingredient) => ingredient.status === "unresolved")
    .map((ingredient) => ingredient.raw);
}

export type ExtractionConfidence = "full" | "partial" | "low";

export function confidenceFromUnresolved(
  unresolvedCount: number,
  totalIngredients: number
): ExtractionConfidence {
  if (unresolvedCount === 0) {
    return "full";
  }
  if (totalIngredients === 0 || unresolvedCount / totalIngredients >= 0.5) {
    return "low";
  }
  return "partial";
}

export function confidenceForVersion(
  version: Pick<ProductVersion, "ingredients">
): {
  unresolved_ingredients: string[];
  confidence: ExtractionConfidence;
} {
  const unresolved_ingredients = unresolvedIngredientNames(version);
  return {
    unresolved_ingredients,
    confidence: confidenceFromUnresolved(
      unresolved_ingredients.length,
      version.ingredients.length
    ),
  };
}

export function canonicalIdsFromVersion(
  version: ProductVersion
): Types.ObjectId[] {
  return version.ingredients
    .map((ingredient) => ingredient.canonical_id)
    .filter((id): id is Types.ObjectId => Boolean(id));
}
