import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Ingredient,
  IngredientDocument,
} from "../database/schemas/ingredient.schema";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import {
  RuleSet,
  RuleSetDocument,
} from "../database/schemas/rule-set.schema";
import {
  ScoringRecord,
  ScoringRecordDocument,
} from "../database/schemas/scoring-record.schema";
import { evaluateRules, type EvaluationResult } from "./evaluate-rules";
import {
  canonicalIdsFromVersion,
  factsFromVersion,
} from "./facts";

@Injectable()
export class ScoringService {
  constructor(
    @InjectModel(RuleSet.name)
    private readonly ruleSets: Model<RuleSetDocument>,
    @InjectModel(ScoringRecord.name)
    private readonly scoringRecords: Model<ScoringRecordDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredients: Model<IngredientDocument>,
  ) {}

  async findActiveRuleSet(at: Date = new Date()): Promise<RuleSetDocument | null> {
    return this.ruleSets
      .findOne({
        effective_from: { $lte: at },
        $or: [{ effective_to: null }, { effective_to: { $gt: at } }],
      })
      .sort({ effective_from: -1 })
      .exec();
  }

  async factsForVersion(
    version: ProductVersion,
  ): Promise<Record<string, unknown>> {
    const ids = canonicalIdsFromVersion(version);
    const docs =
      ids.length === 0
        ? []
        : await this.ingredients.find({ _id: { $in: ids } }).exec();
    const categories = docs.map((doc) => doc.category);
    return factsFromVersion(version, categories);
  }

  evaluate(facts: Record<string, unknown>, ruleSet: RuleSetDocument): EvaluationResult {
    return evaluateRules(facts, ruleSet.rules);
  }

  async ensureScoringRecord(
    version: ProductVersionDocument,
  ): Promise<{
    facts: Record<string, unknown>;
    record: ScoringRecordDocument | null;
    evaluation: EvaluationResult;
    ruleSetVersion: string | null;
  }> {
    const facts = await this.factsForVersion(version);
    const ruleSet = await this.findActiveRuleSet();
    if (!ruleSet) {
      return {
        facts,
        record: null,
        evaluation: { severity: "green", breakdown: [] },
        ruleSetVersion: null,
      };
    }

    const existing = await this.scoringRecords
      .findOne({
        product_version_id: version._id,
        rule_set_version: ruleSet.version,
      })
      .sort({ computed_at: -1 })
      .exec();
    if (existing) {
      return {
        facts,
        record: existing,
        evaluation: {
          severity: existing.severity,
          breakdown: existing.breakdown,
        },
        ruleSetVersion: ruleSet.version,
      };
    }

    const evaluation = this.evaluate(facts, ruleSet);
    const created = await this.scoringRecords.create({
      product_version_id: version._id,
      rule_set_version: ruleSet.version,
      severity: evaluation.severity,
      breakdown: evaluation.breakdown,
    });
    return {
      facts,
      record: created,
      evaluation,
      ruleSetVersion: ruleSet.version,
    };
  }
}
