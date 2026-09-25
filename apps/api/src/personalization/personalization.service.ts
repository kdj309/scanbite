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
    private readonly rules: Model<PersonalizationRuleDocument>,
  ) {}

  async overlay(input: {
    base: EvaluationResult;
    facts: Record<string, unknown>;
    memberConditions: string[];
  }): Promise<PersonalizedVerdict> {
    const rules = await this.rules.find().exec();
    return applyPersonalization({
      base: input.base,
      facts: input.facts,
      memberConditions: input.memberConditions,
      rules,
    });
  }
}
