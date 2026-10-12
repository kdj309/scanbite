import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  PersonalizationRule,
  PersonalizationRuleDocument,
} from "../database/schemas/personalization-rule.schema";
import type { PersonalizationRuleInput } from "./apply-personalization";

@Injectable()
export class PersonalizationService {
  constructor(
    @InjectModel(PersonalizationRule.name)
    private readonly rules: Model<PersonalizationRuleDocument>
  ) {}

  /** Load once per request and reuse across members/products. */
  async activeRules(
    now: Date = new Date()
  ): Promise<PersonalizationRuleInput[]> {
    // Same "currently effective" window as ScoringService.findActiveRuleSet
    // — unlike a rule_set (one document per version), personalization rules
    // are many independent documents, so this is a filter, not a findOne.
    const effective = await this.rules
      .find({
        effective_from: { $lte: now },
        $or: [{ effective_to: null }, { effective_to: { $gt: now } }],
      })
      .lean()
      .exec();
    return latestVersionPerRule(effective);
  }
}

/**
 * If two versions of one rule are effective at once (an overlapping date
 * window left by mistake), only the newest counts — a rule must never fire
 * twice with two thresholds.
 */
export function latestVersionPerRule<
  T extends { id: string; effective_from: Date },
>(rules: T[]): T[] {
  const latest = new Map<string, T>();
  for (const rule of rules) {
    const current = latest.get(rule.id);
    if (!current || rule.effective_from > current.effective_from) {
      latest.set(rule.id, rule);
    }
  }
  return [...latest.values()];
}
