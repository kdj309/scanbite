import { z } from "zod";
import { uniqueListOf } from "./primitives";

/**
 * Allergens we check, from FSSAI Labelling & Display Regs 2020 Reg 5(14)
 * and Codex CXS 1-1985 (rev. 2024). Sesame and mustard aren't mandatory on
 * Indian labels, so a missing "Contains" line never means allergen-free.
 */
export const allergenCodeSchema = z.enum([
  "peanuts",
  "tree_nuts",
  "milk",
  "gluten",
  "egg",
  "fish",
  "shellfish",
  "soy",
  "sesame",
  "mustard",
  "sulphites",
]);
export type AllergenCode = z.infer<typeof allergenCodeSchema>;

export const ALLERGEN_CODES: readonly AllergenCode[] =
  allergenCodeSchema.options;

export const allergenListSchema = uniqueListOf(
  allergenCodeSchema,
  "Duplicate allergy"
);

/** Everyday names for the app and for reason text ("Contains peanuts"). */
export const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  milk: "Milk",
  gluten: "Gluten",
  egg: "Egg",
  fish: "Fish",
  shellfish: "Shellfish",
  soy: "Soy",
  sesame: "Sesame",
  mustard: "Mustard",
  sulphites: "Sulphites",
};
