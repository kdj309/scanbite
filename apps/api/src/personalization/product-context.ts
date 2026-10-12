import { allergenEvidence } from "../allergens/allergen-evidence";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";
import type { ObjectiveVerdict } from "../scoring/scoring.service";
import type { PersonalizationRuleInput } from "./apply-personalization";
import type { ProductContext } from "./household-verdict";

/** Gathers what member verdicts need about one live product version. */
export function productContext(
  version: Pick<ProductVersionDocument, "ingredients" | "declared_allergens">,
  objective: ObjectiveVerdict,
  rules: PersonalizationRuleInput[]
): ProductContext {
  return {
    base: objective,
    facts: objective.facts,
    ruleLabels: objective.rule_labels,
    basePassed: objective.passed_rules,
    rules,
    allergens: allergenEvidence({
      ingredients: version.ingredients.map((ingredient) => ingredient.raw),
      declared: version.declared_allergens,
    }),
  };
}
