import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ProductLookupResponse } from "@foodscanner/shared";
import { Model } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import { ConsensusService } from "../consensus/consensus.service";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import { OffLookupService } from "../off/off-lookup.service";
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

    const personalized = await this.personalization.overlay({
      base: {
        severity: cached.severity,
        breakdown: cached.breakdown,
        unevaluated: cached.unevaluated,
      },
      facts: cached.facts,
      memberConditions: member.conditions ?? [],
    });
    const reasons = [
      ...personalized.reasons,
      ...(personalized.severity === "green"
        ? cached.unevaluated.map((u) => u.reason)
        : []),
      ...personalized.unevaluated.map((u) => u.reason), // personalization gaps always surface, per our earlier call
    ];

    return {
      found: true,
      product: cached.product,
      verdict: {
        severity: personalized.severity,
        reasons,
      },
      confidence: cached.confidence,
      unresolved_ingredients: cached.unresolved_ingredients,
    };
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
