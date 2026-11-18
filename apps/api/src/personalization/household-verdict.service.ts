import { Injectable } from "@nestjs/common";
import type { ProductFoundResponse } from "@foodscanner/shared";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import type { LabelFacts } from "../database/schemas/submission.schema";
import { ProductSummaryService } from "../product-versions/product-summary";
import type { ObjectiveVerdict } from "../scoring/scoring.service";
import { ScoringService } from "../scoring/scoring.service";
import { householdVerdict } from "./household-verdict";
import { productContext } from "./product-context";
import { PersonalizationService } from "./personalization.service";
import type { ReadLabel } from "./personalization.types";

export type HouseholdProductVerdict = {
  response: ProductFoundResponse;
  ruleSetVersion: string;
};

/** One product's verdict for every member of a user's household — shared
 *  by product lookup and scanning so both answer the same way. */
@Injectable()
export class HouseholdVerdictService {
  constructor(
    private readonly scoring: ScoringService,
    private readonly household: HouseholdService,
    private readonly personalization: PersonalizationService,
    private readonly summaries: ProductSummaryService
  ) {}

  async forVersion(
    version: ProductVersionDocument,
    userId: string
  ): Promise<HouseholdProductVerdict> {
    const [objective, { members }, rules] = await Promise.all([
      this.scoring.getCachedObjectiveVerdict(version),
      this.household.listForUser(userId),
      this.personalization.activeRules(),
    ]);
    return {
      response: {
        found: true,
        product: this.summaries.summarize(version),
        ...householdVerdict(productContext(version, objective, rules), members),
        ...coverage(objective),
        ...whatWasRead(version),
      },
      ruleSetVersion: objective.rule_set_version,
    };
  }

  /** The same, for a label check: a pack with no barcode. */
  async forLabelCheck(
    labelCheckId: string,
    label: LabelFacts,
    userId: string
  ): Promise<HouseholdProductVerdict> {
    const [objective, { members }, rules] = await Promise.all([
      this.scoring.objectiveVerdictForLabel(label),
      this.household.listForUser(userId),
      this.personalization.activeRules(),
    ]);
    const context = productContext(
      { ingredients: label.ingredients, declared_allergens: null },
      objective,
      rules
    );
    return {
      response: {
        found: true,
        product: this.summaries.summarizeLabelCheck(labelCheckId, label),
        ...householdVerdict(context, members),
        ...coverage(objective),
        ...whatWasRead(label),
      },
      ruleSetVersion: objective.rule_set_version,
    };
  }
}

function whatWasRead(label: ReadLabel) {
  return {
    ingredients: label.ingredients.map((ingredient) => ingredient.raw),
    nutrition: label.nutrition,
  };
}

function coverage(objective: ObjectiveVerdict) {
  return {
    confidence: objective.confidence,
    unresolved_ingredients: objective.unresolved_ingredients,
  };
}
