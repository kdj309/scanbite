import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  ListRuleExplainersQuery,
  ListRuleExplainersResponse,
} from "@foodscanner/shared";
import { Model } from "mongoose";
import type { RequestUser } from "../auth/auth.types";
import {
  RuleExplainer,
  RuleExplainerDocument,
} from "../database/schemas/rule-explainer.schema";
import { HouseholdService } from "../household/household.service";
import { conditionMatches } from "../personalization/apply-personalization";

@Injectable()
export class RuleExplainersService {
  constructor(
    @InjectModel(RuleExplainer.name)
    private readonly explainers: Model<RuleExplainerDocument>,
    private readonly household: HouseholdService
  ) {}

  async list(
    user: RequestUser,
    query: ListRuleExplainersQuery
  ): Promise<ListRuleExplainersResponse> {
    const ids = [
      ...new Set(
        query.ids
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ];
    const member = await this.household.resolveMemberId(
      user.userId,
      query.member_id,
      user.defaultMemberId
    );
    const memberConditions = member.conditions ?? [];

    const docs = await this.explainers.find({ rule_ids: { $in: ids } }).exec();

    return {
      items: docs.map((doc) => ({
        rule_ids: doc.rule_ids,
        title: doc.title,
        explainer: doc.explainer,
        addendum: this.resolveAddendum(doc, memberConditions),
        citations: doc.citations,
      })),
    };
  }

  private resolveAddendum(
    doc: RuleExplainerDocument,
    memberConditions: string[]
  ): string | null {
    const match = doc.condition_variants.find((variant) =>
      conditionMatches(memberConditions, variant.condition)
    );
    return match?.addendum ?? null;
  }
}
