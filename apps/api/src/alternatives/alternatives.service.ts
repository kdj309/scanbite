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
} from "../personalization/household-verdict";
import { PersonalizationService } from "../personalization/personalization.service";
import { productContext } from "../personalization/product-context";
import { ProductSummaryService } from "../product-versions/product-summary";
import { categoriesOn, shelfOf, type Shelf } from "../product-versions/shelves";
import { dessertCategories, isDessertForm } from "../scoring/dessert-groups";
import { productFormFilter } from "../scoring/facts";
import { ScoringService } from "../scoring/scoring.service";
import {
  rankAlternatives,
  rankCautionAlternatives,
  type RuleFacts,
} from "./rank-alternatives";
import type { RuleInput } from "../scoring/evaluate-rules";
import { closeness } from "./closeness";
import type { AlternativeMember } from "./rank-alternatives.types";

const MAX_ALTERNATIVES = 5;
/** "Better, not perfect" (design 4a), below the Safe ones. */
const MAX_CAUTION = 3;
/** Enough of a shelf to find good options without scoring thousands. */
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

    const notSafe = (member: AlternativeMember) =>
      verdictFor(originalContext, member).severity !== "green";
    const profiled = members.filter(hasHealthProfile);
    const notSafeFor = profiled.filter(notSafe);
    // With nobody's profile set up yet, it's the general verdict that counts.
    const lookingFor: AlternativeMember[] = profiled.length
      ? notSafeFor
      : [GENERAL_MEMBER].filter(notSafe);

    const response = {
      instead_of: this.summaries.summarize(original),
      for_member_ids: notSafeFor.map((member) => member.id),
      alternatives: [] as AlternativesResponse["alternatives"],
      better_not_perfect: [] as AlternativesResponse["better_not_perfect"],
    };
    // Swaps come from the same shelf: categories are filed too unevenly to
    // compare within one (product-versions/shelves.ts).
    const shelf = shelfOf(original.category);
    if (lookingFor.length === 0 || shelf === null) {
      return response;
    }

    const candidates = await this.versions
      .find({
        status: "live",
        category: { $in: candidateCategories(originalContext.facts, shelf) },
        barcode: { $ne: barcode },
        // Can't show or link to a product we can't name.
        name: { $not: /^unknown$/i },
        ...formFilter(originalContext.facts.product_form),
      })
      .sort({ created_at: -1 })
      .limit(MAX_CANDIDATES)
      .exec();

    const input = {
      original: originalContext,
      candidates: await Promise.all(
        candidates.map(async (version) => ({
          item: version,
          context: await context(version),
        }))
      ),
      members: lookingFor,
      ruleFacts: ruleFacts(ruleSet.rules, rules),
      closenessOf: (version: ProductVersionDocument) =>
        closeness(original, version),
    };
    const safe = rankAlternatives({ ...input, limit: MAX_ALTERNATIVES });
    response.alternatives = safe.map(({ item, improvements }) => ({
      product: this.summaries.summarize(item),
      improvements,
    }));
    // Safe swaps can be poor matches on a mixed shelf (vinegar for
    // ketchup), so the closer Caution ones show below them too.
    const caution = rankCautionAlternatives({ ...input, limit: MAX_CAUTION });
    response.better_not_perfect = caution.map(
      ({ item, improvements, stillFlagged }) => ({
        product: this.summaries.summarizeWithoutAffiliate(item),
        improvements,
        still_flagged: stillFlagged,
      })
    );
    return response;
  }
}

/** The shelf, or for a dessert only its own WHO group (limits differ). */
function candidateCategories(
  facts: Record<string, unknown>,
  shelf: Shelf
): string[] {
  const form = facts.product_form;
  return isDessertForm(form) ? dessertCategories(form) : categoriesOn(shelf);
}

/**
 * Drinks against drinks, solids against solids. Desserts are compared on
 * their shelf whatever unit their label uses: their WHO limits read per
 * 100 g or per 100 ml as declared.
 */
function formFilter(form: unknown) {
  if (isDessertForm(form)) {
    return {};
  }
  return productFormFilter(form === "liquid" ? "liquid" : "solid");
}

function ruleFacts(
  ...ruleLists: Array<Array<Pick<RuleInput, "id" | "field" | "threshold">>>
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
