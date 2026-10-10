import { ALLERGEN_CODES, type AllergenCode } from "@foodscanner/shared";
import { ALLERGEN_ALIASES } from "./allergen-aliases";

/** What a product's pack declares (OFF allergen/trace tags today; the
 *  label's "Contains / May contain" lines once vision reads them). */
export type DeclaredAllergens = {
  contains: AllergenCode[];
  may_contain: AllergenCode[];
};

export type AllergenFinding = {
  presence: "contains" | "may_contain";
  /** Why we think so: the ingredient that matched, or null if declared. */
  ingredient: string | null;
};

export type AllergenEvidence = {
  findings: Partial<Record<AllergenCode, AllergenFinding>>;
  /** Without an ingredient list we can't rule anything out. */
  hasIngredientList: boolean;
};

// Everything from the first match on is cross-contact, not a recipe item:
// "May contain traces of nuts, milk" splits into two "ingredients".
const MAY_CONTAIN =
  /\bmay contain\b|\btraces? of\b|\b(same|shared) (facility|equipment|line)\b|\bprocessed in a (facility|plant)\b/i;

/**
 * Combines what the pack declares with our own ingredient-name scan: if
 * either says an allergen is there, it's there. "Contains" beats "may
 * contain" for the same allergen.
 */
export function allergenEvidence(input: {
  ingredients: string[];
  declared: DeclaredAllergens | null;
}): AllergenEvidence {
  const findings: AllergenEvidence["findings"] = {};
  const record = (code: AllergenCode, finding: AllergenFinding) => {
    if (findings[code]?.presence !== "contains") {
      findings[code] = finding;
    }
  };

  let crossContact = false;
  for (const ingredient of input.ingredients) {
    crossContact ||= MAY_CONTAIN.test(ingredient);
    for (const code of allergensIn(ingredient)) {
      record(code, {
        presence: crossContact ? "may_contain" : "contains",
        ingredient: ingredient.trim(),
      });
    }
  }
  for (const code of input.declared?.may_contain ?? []) {
    record(code, { presence: "may_contain", ingredient: null });
  }
  for (const code of input.declared?.contains ?? []) {
    record(code, { presence: "contains", ingredient: null });
  }

  return { findings, hasIngredientList: input.ingredients.length > 0 };
}

/** Allergens named in one ingredient string. */
export function allergensIn(ingredient: string): AllergenCode[] {
  const text = ingredient.toLowerCase();
  return ALLERGEN_CODES.filter((code) => {
    const { include, exclude = [] } = ALLERGEN_ALIASES[code];
    const cleaned = exclude.reduce(
      (remaining, pattern) => remaining.replace(new RegExp(pattern, "g"), " "),
      text
    );
    return include.some((pattern) => pattern.test(cleaned));
  });
}
