import { Types } from "mongoose";
import type { ProductVersion } from "../database/schemas/product-version.schema";

export function factsFromVersion(
  version: ProductVersion,
  ingredientCategories: string[],
): Record<string, unknown> {
  const nutrition = version.nutrition ?? {};
  return {
    ...nutrition,
    sugar_per_100g: nutrition.sugar_per_100g,
    additive_count: version.additive_count ?? nutrition.additive_count,
    nova_group: version.nova_group ?? nutrition.nova_group,
    ingredient_category: ingredientCategories,
  };
}

export function unresolvedIngredientNames(
  version: ProductVersion,
): string[] {
  return version.ingredients
    .filter((ingredient) => ingredient.status === "unresolved")
    .map((ingredient) => ingredient.raw);
}

export function confidenceFromUnresolved(
  unresolvedCount: number,
  totalIngredients: number,
): "full" | "partial" | "low" {
  if (unresolvedCount === 0) {
    return "full";
  }
  if (totalIngredients === 0 || unresolvedCount / totalIngredients >= 0.5) {
    return "low";
  }
  return "partial";
}

export function canonicalIdsFromVersion(version: ProductVersion): Types.ObjectId[] {
  return version.ingredients
    .map((ingredient) => ingredient.canonical_id)
    .filter((id): id is Types.ObjectId => Boolean(id));
}
