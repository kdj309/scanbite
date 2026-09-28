import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ProductLookupResponse } from "@foodscanner/shared";
import { Model } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { HouseholdService } from "../household/household.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { ScoringService } from "../scoring/scoring.service";

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ProductVersion.name)
    private readonly versions: Model<ProductVersionDocument>,
    private readonly scoring: ScoringService,
    private readonly personalization: PersonalizationService,
    private readonly household: HouseholdService
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

    const version = await this.versions
      .findOne({ barcode, status: "live" })
      .exec();
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
}
