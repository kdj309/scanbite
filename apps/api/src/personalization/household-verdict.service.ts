import { Injectable } from "@nestjs/common";
import type { ProductFoundResponse } from "@foodscanner/shared";
import type { ProductVersionDocument } from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import { productSummary } from "../product-versions/product-summary";
import { ScoringService } from "../scoring/scoring.service";
import { householdVerdict } from "./household-verdict";
import { productContext } from "./product-context";
import { PersonalizationService } from "./personalization.service";

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
    private readonly personalization: PersonalizationService
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
        product: productSummary(version),
        ...householdVerdict(productContext(version, objective, rules), members),
        confidence: objective.confidence,
        unresolved_ingredients: objective.unresolved_ingredients,
      },
      ruleSetVersion: objective.rule_set_version,
    };
  }
}
