import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  PersonalizationRule,
  PersonalizationRuleDocument,
} from "../database/schemas/personalization-rule.schema";
import type { EvaluationResult } from "../scoring/evaluate-rules";
import {
  applyPersonalization,
  type PersonalizedVerdict,
} from "./apply-personalization";

@Injectable()
export class PersonalizationService {
  constructor(
    @InjectModel(PersonalizationRule.name)
    private readonly rules: Model<PersonalizationRuleDocument>
  ) {}

  async overlay(input: {
    base: EvaluationResult;
    facts: Record<string, unknown>;
    memberConditions: string[];
  }): Promise<PersonalizedVerdict> {
    const now = new Date();
    // Same "currently effective" window as ScoringService.findActiveRuleSet
    // — unlike a rule_set (one document per version), personalization rules
    // are many independent documents, so this is a filter, not a findOne.
    const rules = await this.rules
      .find({
        effective_from: { $lte: now },
        $or: [{ effective_to: null }, { effective_to: { $gt: now } }],
      })
      .exec();
    return applyPersonalization({
      base: input.base,
      facts: input.facts,
      memberConditions: input.memberConditions,
      rules,
    });
  }
}
