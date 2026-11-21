import { Types } from "mongoose";
import type { ProductVersion } from "../database/schemas/product-version.schema";
import { shelfOf } from "../product-versions/shelves";
import { dessertForm, type DessertForm } from "./dessert-groups";
import type { VersionConfidence } from "./facts.types";

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

/** The same rule as a product_versions query, kept next to it on purpose. */
export function productFormFilter(form: "solid" | "liquid") {
  return { "nutrition.sugar_per_100ml": { $exists: form === "liquid" } };
}

/** What scoring reads: a product version's label fields, or a label
 *  check's (which has no version). */
export type LabelFields = Pick<
  ProductVersion,
  "ingredients" | "nutrition" | "nova_group" | "additive_count" | "category"
>;

/**
 * Solid or liquid from how the label reports it (above); ice cream and
 * dairy desserts are never drinks, though their labels are often per
 * 100 ml. A dessert we can't place in a WHO group (a label read that only
 * says "Desserts & ice cream") gets the general solid rules.
 */
function productForm(
  category: string,
  nutrition: Record<string, number | string | null>
): "solid" | "liquid" | DessertForm {
  const dessert = dessertForm(category);
  if (dessert) {
    return dessert;
  }
  if (onDessertShelf(category)) {
    return "solid";
  }
  return productFormFromNutrition(nutrition);
}

function onDessertShelf(category: string): boolean {
  return shelfOf(category) === "Desserts & ice cream";
}

/**
 * Not a drink, but reported per 100 ml: those are the declared values the
 * per-100 g rules read (WHO's dessert limits allow either basis).
 */
function per100mlAsDeclared(
  nutrition: Record<string, number | string | null>
): Record<string, number | string | null> {
  return Object.fromEntries(
    Object.entries(nutrition).flatMap(([key, value]) => {
      const asGrams = key.replace(/_per_100ml$/, "_per_100g");
      return key.endsWith("_per_100ml") && nutrition[asGrams] === undefined
        ? [[asGrams, value]]
        : [];
    })
  );
}

export function factsFromVersion(
  version: LabelFields,
  ingredientCategories: string[]
): Record<string, unknown> {
  const nutrition = version.nutrition ?? {};
  const form = productForm(version.category, nutrition);
  const reported = {
    ...nutrition,
    ...(onDessertShelf(version.category) ? per100mlAsDeclared(nutrition) : {}),
  };
  return {
    ...reported,
    sugar_per_100g: reported.sugar_per_100g,
    additive_count: version.additive_count ?? nutrition.additive_count,
    nova_group: version.nova_group ?? nutrition.nova_group,
    ingredient_category: ingredientCategories,
    product_form: form,
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
  // No list at all isn't "all recognised": nothing was read.
  if (totalIngredients === 0) {
    return "low";
  }
  if (unresolvedCount === 0) {
    return "full";
  }
  if (unresolvedCount / totalIngredients >= 0.5) {
    return "low";
  }
  return "partial";
}

export function confidenceForVersion(
  version: Pick<ProductVersion, "ingredients">
): VersionConfidence {
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
  version: Pick<ProductVersion, "ingredients">
): Types.ObjectId[] {
  return version.ingredients
    .map((ingredient) => ingredient.canonical_id)
    .filter((id): id is Types.ObjectId => Boolean(id));
}
