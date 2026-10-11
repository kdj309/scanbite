import { ALLERGEN_CODES, type AllergenCode } from "@foodscanner/shared";
import { namesAlias } from "../common/alias-match";
import { splitCrossContact } from "../common/cross-contact";
import { ALLERGEN_ALIASES } from "./allergen-aliases";

/** What a product's pack declares (OFF allergen/trace tags today; the
 *  label's "Contains / May contain" lines once vision reads them). */
export type DeclaredAllergens = {
  contains: AllergenCode[];
  may_contain: AllergenCode[];
};

type Presence = "contains" | "may_contain";

export type AllergenFinding = {
  presence: Presence;
  /** Why we think so: the ingredient that matched, or null if declared. */
  ingredient: string | null;
};

export type AllergenEvidence = {
  findings: Partial<Record<AllergenCode, AllergenFinding>>;
  /** Without an ingredient list we can't rule anything out. */
  hasIngredientList: boolean;
};

/**
 * Combines what the pack declares with our own ingredient-name scan: if
 * either says an allergen is there, it's there. "Contains" beats "may
 * contain", and an ingredient we can point at beats a bare declaration.
 */
export function allergenEvidence(input: {
  ingredients: string[];
  declared: DeclaredAllergens | null;
}): AllergenEvidence {
  const { recipe, crossContact } = splitCrossContact(input.ingredients);

  // Strongest first — the first finding for an allergen wins.
  const candidates = [
    ...foundIn(recipe, "contains"),
    ...declared(input.declared?.contains, "contains"),
    ...foundIn(crossContact, "may_contain"),
    ...declared(input.declared?.may_contain, "may_contain"),
  ];

  const findings: AllergenEvidence["findings"] = {};
  for (const [code, finding] of candidates) {
    findings[code] ??= finding;
  }
  return { findings, hasIngredientList: input.ingredients.length > 0 };
}

type Candidate = readonly [AllergenCode, AllergenFinding];

/** Allergens named in these ingredients, with the ingredient as proof. */
function foundIn(ingredients: string[], presence: Presence): Candidate[] {
  return ingredients.flatMap((ingredient) =>
    allergensIn(ingredient).map((code): Candidate => [
      code,
      { presence, ingredient: ingredient.trim() },
    ])
  );
}

/** Allergens the pack declares (no ingredient to point at). */
function declared(codes: AllergenCode[] = [], presence: Presence): Candidate[] {
  return codes.map((code): Candidate => [code, { presence, ingredient: null }]);
}

/** Allergens named in one ingredient string. */
export function allergensIn(ingredient: string): AllergenCode[] {
  return ALLERGEN_CODES.filter((code) =>
    namesAlias(ingredient, ALLERGEN_ALIASES[code])
  );
}
