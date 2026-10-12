import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CatalogSection,
  CategoriesResponse,
  CatalogItem,
  CatalogQuery,
  CatalogResponse,
  ProductLookupResponse,
} from "@foodscanner/shared";
import { FilterQuery, Model, Types } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import { escapeRegex } from "../common/escape-regex";
import { ConsensusService } from "../consensus/consensus.service";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import { OffLookupService } from "../off/off-lookup.service";
import {
  hasHealthProfile,
  type HouseholdMemberInput,
} from "../personalization/household-verdict";
import { HouseholdVerdictService } from "../personalization/household-verdict.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { productContext } from "../personalization/product-context";
import { ProductSummaryService } from "../product-versions/product-summary";
import { ProductVersionIngestionService } from "../product-versions/product-version-ingestion.service";
import { SEVERITY_RANK } from "../scoring/evaluate-rules";
import { ScoringService } from "../scoring/scoring.service";
import { catalogEntry } from "./catalog-entry";

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly scoring: ScoringService,
    private readonly personalization: PersonalizationService,
    private readonly householdVerdicts: HouseholdVerdictService,
    private readonly household: HouseholdService,
    private readonly off: OffLookupService,
    private readonly ingestion: ProductVersionIngestionService,
    private readonly consensus: ConsensusService,
    private readonly summaries: ProductSummaryService
  ) {}

  /** Read-only view (Explore, a recents tap): answers for the whole
   *  household. Scanning goes through POST /scans, which also records it. */
  async lookup(
    barcode: string,
    user: RequestUser
  ): Promise<ProductLookupResponse> {
    const version = await this.resolveLive(barcode);
    if (!version) {
      return { found: false };
    }
    return (await this.householdVerdicts.forVersion(version, user.userId))
      .response;
  }

  /** The live version, importing it from Open Food Facts on first sight. */
  async resolveLive(barcode: string): Promise<ProductVersionDocument | null> {
    return (await this.liveVersion(barcode)) ?? this.seedFromOff(barcode);
  }

  /** Explore's chips: live products per category, biggest first. Same
   *  filter as catalog(), so a chip's count matches what tapping it shows. */
  async categories(): Promise<CategoriesResponse> {
    const groups = await this.versions
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: "live", category: { $ne: "unknown" } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ])
      .exec();
    return {
      categories: groups.map(({ _id, count }) => ({ name: _id, count })),
    };
  }

  /**
   * Catalog search/filter (HLD §15) — a second entry point into the exact
   * same scoring+personalization pipeline `lookup()` uses, run across a
   * filtered set of already-live products instead of one barcode. No new
   * scoring logic here, only query/pagination plumbing.
   */
  async catalog(
    user: RequestUser,
    query: CatalogQuery
  ): Promise<CatalogResponse> {
    const included = await this.includedMembers(user, query.member_ids);
    const limit = query.limit ?? 20;

    const filter: FilterQuery<ProductVersionDocument> = { status: "live" };
    if (query.category) {
      filter.category = query.category;
    }
    if (query.brand) {
      filter.brand = query.brand;
    }
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ name: pattern }, { brand: pattern }];
    }
    if (query.cursor && Types.ObjectId.isValid(query.cursor)) {
      const cursorDoc = await this.versions.findById(query.cursor).exec();
      if (cursorDoc) {
        // Pagination sorts on created_at/_id, never on severity — severity
        // is computed below, after this query runs, so Mongo can't sort or
        // cursor on it (HLD §15's "query and ranking" correctness note).
        const cursorRange = {
          $or: [
            { created_at: { $lt: cursorDoc.created_at } },
            { created_at: cursorDoc.created_at, _id: { $lt: cursorDoc._id } },
          ],
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, cursorRange];
          delete filter.$or;
        } else {
          Object.assign(filter, cursorRange);
        }
      }
    }

    const candidates = await this.versions
      .find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(limit + 1)
      .exec();
    const hasMore = candidates.length > limit;
    const page = hasMore ? candidates.slice(0, limit) : candidates;

    // Loaded once for the page, not once per product.
    const [ruleSet, rules] = await Promise.all([
      this.scoring.activeRuleSet(),
      this.personalization.activeRules(),
    ]);
    const scored: CatalogItem[] = await Promise.all(
      page.map(async (version) => {
        const cached = await this.scoring.getCachedObjectiveVerdict(
          version,
          ruleSet
        );
        return {
          product: this.summaries.summarize(version),
          ...catalogEntry(productContext(version, cached, rules), included),
          confidence: cached.confidence,
        };
      })
    );
    // Sections are a post-filter, not a DB filter (HLD §15): a page can hold
    // fewer than `limit` items, and the cursor still advances off the last
    // *fetched* document (page[page.length - 1] below).
    const items = query.section
      ? scored.filter((item) => sectionOf(item) === query.section)
      : scored;

    return {
      for_member_ids: included.map((member) => member.id),
      // Worst first within the page (sort is stable: newest first on ties).
      items: items.sort(
        (a, b) =>
          SEVERITY_RANK[b.overall.severity] - SEVERITY_RANK[a.overall.severity]
      ),
      next_cursor: hasMore ? (page[page.length - 1].id as string) : null,
    };
  }

  /**
   * Who a catalog page answers for: the "shopping for" toggles, or everyone
   * with a health profile. Only profile members can be chosen — anyone else
   * would just get the general verdict.
   */
  private async includedMembers(
    user: RequestUser,
    memberIds: string[] | undefined
  ): Promise<HouseholdMemberInput[]> {
    const profiled = (
      await this.household.listForUser(user.userId)
    ).members.filter(hasHealthProfile);
    if (!memberIds) {
      return profiled;
    }
    const chosen = profiled.filter((member) => memberIds.includes(member.id));
    if (chosen.length !== new Set(memberIds).size) {
      throw new BadRequestException(
        "member_ids must be your household members with a health profile"
      );
    }
    return chosen;
  }

  private liveVersion(barcode: string): Promise<ProductVersionDocument | null> {
    return this.versions.findOne({ barcode, status: "live" }).exec();
  }

  /**
   * Seeds a ProductVersion from OFF the first time this barcode is ever
   * looked up, and promotes it inline (no queue) so the same request can
   * return the result immediately. A fresh barcode's first version always
   * auto-promotes (see shouldAutoPromote) unless another submission won the
   * race concurrently, in which case we just surface whatever ended up live.
   */
  private async seedFromOff(
    barcode: string
  ): Promise<ProductVersionDocument | null> {
    const extracted = await this.off.lookup(barcode);
    if (!extracted) {
      return null;
    }

    const ingredients = await this.ingestion.resolveIngredients(
      extracted.ingredients
    );
    const pending = await this.ingestion.createPendingVersion({
      barcode,
      name: extracted.name,
      brand: extracted.brand,
      category: extracted.category,
      ingredients,
      nutrition: extracted.nutrition,
      nova_group: extracted.nova_group,
      additive_count: extracted.additive_count,
      source: "off",
      image_url: extracted.image_url,
      quantity: extracted.quantity,
      declared_allergens: extracted.declared_allergens,
      declared_veg: extracted.declared_veg,
    });

    const result = await this.consensus.promoteIfEligible(pending.id as string);
    if (!result.promoted) {
      this.logger.log(
        `OFF seed for ${barcode} did not auto-promote (${result.reason}); leaving pending`
      );
    }
    return this.liveVersion(barcode);
  }
}

/** Explore's shelf or list: Safe for everyone included, or not. */
function sectionOf(item: CatalogItem): CatalogSection {
  return item.overall.severity === "green" ? "good_for_all" : "not_for_all";
}
