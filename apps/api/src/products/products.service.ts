import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  CatalogItem,
  CatalogQuery,
  CatalogResponse,
  ProductLookupResponse,
} from "@foodscanner/shared";
import type { CachedObjectiveVerdict } from "../common/verdict-cache.service";
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
import type {
  PersonalizedVerdict,
  VerdictReason,
} from "../personalization/apply-personalization";
import { PersonalizationService } from "../personalization/personalization.service";
import { ProductVersionIngestionService } from "../product-versions/product-version-ingestion.service";
import { ScoringService } from "../scoring/scoring.service";

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly scoring: ScoringService,
    private readonly personalization: PersonalizationService,
    private readonly household: HouseholdService,
    private readonly off: OffLookupService,
    private readonly ingestion: ProductVersionIngestionService,
    private readonly consensus: ConsensusService
  ) {}

  async lookup(
    barcode: string,
    user: RequestUser,
    memberId?: string
  ): Promise<ProductLookupResponse> {
    const member = await this.household.resolveMemberId(
      user.userId,
      memberId,
      user.defaultMemberId
    );

    const version =
      (await this.liveVersion(barcode)) ?? (await this.seedFromOff(barcode));
    if (!version) {
      return { found: false };
    }

    const cached = await this.scoring.getCachedObjectiveVerdict(version);
    const personalized = await this.personalize(cached, member.conditions);

    return {
      found: true,
      member_has_conditions: (member.conditions ?? []).length > 0,
      product: cached.product,
      verdict: {
        severity: personalized.severity,
        reasons: this.buildReasons(cached, personalized),
      },
      confidence: cached.confidence,
      unresolved_ingredients: cached.unresolved_ingredients,
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
    const member = await this.household.resolveMemberId(
      user.userId,
      query.member_id,
      user.defaultMemberId
    );
    const memberHasConditions = (member.conditions ?? []).length > 0;
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

    const items: CatalogItem[] = [];
    for (const version of page) {
      const cached = await this.scoring.getCachedObjectiveVerdict(version);
      const personalized = await this.personalize(cached, member.conditions);
      // Severity is a post-filter, not a DB filter (HLD §15) — a page can
      // return fewer than `limit` items when this is set; the cursor still
      // advances off the last *fetched* document (page[page.length - 1]
      // below), not the last one that survives this filter.
      if (query.severity && personalized.severity !== query.severity) {
        continue;
      }
      items.push({
        product: cached.product,
        verdict: {
          severity: personalized.severity,
          reasons: this.buildReasons(cached, personalized),
        },
        confidence: cached.confidence,
      });
    }

    return {
      member_has_conditions: memberHasConditions,
      items,
      next_cursor: hasMore ? (page[page.length - 1].id as string) : null,
    };
  }

  private personalize(
    cached: CachedObjectiveVerdict,
    memberConditions: string[]
  ): Promise<PersonalizedVerdict> {
    return this.personalization.overlay({
      base: {
        severity: cached.severity,
        breakdown: cached.breakdown,
        unevaluated: cached.unevaluated,
      },
      facts: cached.facts,
      memberConditions: memberConditions ?? [],
    });
  }

  /**
   * Merges base-rule reasons with personalization escalations/gaps into
   * one list (HLD §10), keeping each reason's rule_id so a client can
   * look up its explainer (HLD §16) instead of a bare display string.
   */
  private buildReasons(
    cached: CachedObjectiveVerdict,
    personalized: PersonalizedVerdict
  ): VerdictReason[] {
    return [
      ...personalized.reasons,
      ...(personalized.severity === "green"
        ? cached.unevaluated.map((u) => ({
            text: u.reason,
            rule_id: u.rule_id,
          }))
        : []),
      ...personalized.unevaluated.map((u) => ({
        text: u.reason,
        rule_id: u.rule_id,
      })), // personalization gaps always surface, per our earlier call
    ];
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
      extraction_confidence: extracted.extraction_confidence,
      source: "off",
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
