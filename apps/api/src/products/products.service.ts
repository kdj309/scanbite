import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ProductLookupResponse } from "@foodscanner/shared";
import { Model } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import { VerdictCacheService } from "../common/verdict-cache.service";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import { PersonalizationService } from "../personalization/personalization.service";
import {
  confidenceFromUnresolved,
  unresolvedIngredientNames,
} from "../scoring/facts";
import { ScoringService } from "../scoring/scoring.service";

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly scoring: ScoringService,
    private readonly personalization: PersonalizationService,
    private readonly household: HouseholdService,
    private readonly cache: VerdictCacheService,
  ) {}

  async lookup(
    barcode: string,
    user: RequestUser,
    memberId?: string,
  ): Promise<ProductLookupResponse> {
    const member = await this.household.resolveMemberId(
      user.userId,
      memberId,
      user.defaultMemberId,
    );

    const version = await this.versions
      .findOne({ barcode, status: "live" })
      .exec();
    if (!version) {
      return { found: false };
    }

    const versionId = version.id as string;
    let cached = this.cache.get(barcode, versionId);
    if (!cached) {
      const scored = await this.scoring.ensureScoringRecord(version);
      const unresolved = unresolvedIngredientNames(version);
      cached = {
        product: {
          name: version.name,
          brand: version.brand,
          product_version_id: versionId,
        },
        facts: scored.facts,
        severity: scored.evaluation.severity,
        breakdown: scored.evaluation.breakdown,
        unresolved_ingredients: unresolved,
        confidence: confidenceFromUnresolved(
          unresolved.length,
          version.ingredients.length,
        ),
      };
      this.cache.set(barcode, versionId, cached);
    }

    const personalized = await this.personalization.overlay({
      base: { severity: cached.severity, breakdown: cached.breakdown },
      facts: cached.facts,
      memberConditions: member.conditions ?? [],
    });

    return {
      found: true,
      product: cached.product,
      verdict: {
        severity: personalized.severity,
        reasons: personalized.reasons,
      },
      confidence: cached.confidence,
      unresolved_ingredients: cached.unresolved_ingredients,
    };
  }
}
