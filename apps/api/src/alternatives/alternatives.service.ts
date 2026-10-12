import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { AlternativesResponse } from "@foodscanner/shared";
import { Model } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import {
  GENERAL_MEMBER,
  hasHealthProfile,
  verdictFor,
  type HouseholdMemberInput,
} from "../personalization/household-verdict";

type Member = Pick<HouseholdMemberInput, "conditions" | "allergies">;
import { PersonalizationService } from "../personalization/personalization.service";
import { productContext } from "../personalization/product-context";
import { ProductSummaryService } from "../product-versions/product-summary";
import { productFormFilter } from "../scoring/facts";
import { ScoringService } from "../scoring/scoring.service";
import { rankAlternatives, type RuleFacts } from "./rank-alternatives";

const MAX_ALTERNATIVES = 5;
/** Enough of a category to find good options without scoring thousands. */
const MAX_CANDIDATES = 200;

@Injectable()
export class AlternativesService {
  constructor(
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly scoring: ScoringService,
    private readonly personalization: PersonalizationService,
    private readonly household: HouseholdService,
    private readonly summaries: ProductSummaryService
  ) {}

  /** "Better options": for everyone the scanned product isn't Safe for. */
  async forProduct(
    barcode: string,
    user: RequestUser
  ): Promise<AlternativesResponse> {
    const original = await this.versions
      .findOne({ barcode, status: "live" })
      .exec();
    if (!original) {
      throw new NotFoundException("Product not found");
    }
    const [ruleSet, rules, { members }] = await Promise.all([
      this.scoring.activeRuleSet(),
      this.personalization.activeRules(),
      this.household.listForUser(user.userId),
    ]);
    const context = async (version: ProductVersionDocument) =>
      productContext(
        version,
        await this.scoring.getCachedObjectiveVerdict(version, ruleSet),
        rules
      );
    const originalContext = await context(original);

    const notSafe = (member: Member) =>
      verdictFor(originalContext, member).severity !== "green";
    const profiled = members.filter(hasHealthProfile);
    const notSafeFor = profiled.filter(notSafe);
    // With nobody's profile set up yet, it's the general verdict that counts.
    const lookingFor: Member[] = profiled.length
      ? notSafeFor
      : [GENERAL_MEMBER].filter(notSafe);

    const response = {
      instead_of: this.summaries.summarize(original),
      for_member_ids: notSafeFor.map((member) => member.id),
      alternatives: [] as AlternativesResponse["alternatives"],
    };
    if (lookingFor.length === 0 || original.category === "unknown") {
      return response;
    }

    const candidates = await this.versions
      .find({
        status: "live",
        category: original.category,
        barcode: { $ne: barcode },
        // Can't show or link to a product we can't name.
        name: { $not: /^unknown$/i },
        ...productFormFilter(
          originalContext.facts.product_form === "liquid" ? "liquid" : "solid"
        ),
      })
      .sort({ created_at: -1 })
      .limit(MAX_CANDIDATES)
      .exec();

    const ranked = rankAlternatives({
      original: originalContext,
      candidates: await Promise.all(
        candidates.map(async (version) => ({
          item: version,
          context: await context(version),
        }))
      ),
      members: lookingFor,
      ruleFacts: ruleFacts(ruleSet.rules, rules),
      limit: MAX_ALTERNATIVES,
    });
    response.alternatives = ranked.map(({ item, improvements }) => ({
      product: this.summaries.summarize(item),
      improvements,
    }));
    return response;
  }
}

function ruleFacts(
  ...ruleLists: Array<Array<{ id: string; field: string; threshold?: number }>>
): RuleFacts {
  return Object.fromEntries(
    ruleLists
      .flat()
      .map((rule) => [
        rule.id,
        { field: rule.field, threshold: rule.threshold },
      ])
  );
}
