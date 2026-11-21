import type { DeclaredAllergens } from "./allergen-evidence";

export type AllergenEvidenceInput = {
  ingredients: string[];
  declared: DeclaredAllergens | null;
};
