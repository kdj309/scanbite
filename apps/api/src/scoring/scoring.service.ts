import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  type CachedObjectiveVerdict,
  VerdictCacheService,
} from "../common/verdict-cache.service";
import {
  Ingredient,
  IngredientDocument,
} from "../database/schemas/ingredient.schema";
import {
  ProductVersion,
  ProductVersionDocument,
} from "../database/schemas/product-version.schema";
import { RuleSet, RuleSetDocument } from "../database/schemas/rule-set.schema";
import {
  ScoringRecord,
  ScoringRecordDocument,
} from "../database/schemas/scoring-record.schema";
import {
  MISSING_ACTIVE_RULE_SET,
  requireActiveRuleSet,
} from "./active-rule-set";
import { evaluateRules, type EvaluationResult } from "./evaluate-rules";
import {
  canonicalIdsFromVersion,
  confidenceForVersion,
  factsFromVersion,
  type ExtractionConfidence,
} from "./facts";

/** The cached verdict plus display labels read from the active rule set at
 *  serve time — labels are copy, so changing one never needs a re-score or
 *  a cache flush. */
export type ObjectiveVerdict = CachedObjectiveVerdict & {
  rule_labels: Record<string, string>;
};

@Injectable()
export class ScoringService {
  constructor(
    @InjectModel(RuleSet.name)
    private readonly ruleSets: Model<RuleSetDocument>,
    @InjectModel(ScoringRecord.name)
    private readonly scoringRecords: Model<ScoringRecordDocument>,
    @InjectModel(Ingredient.name)
    private readonly ingredients: Model<IngredientDocument>,
    private readonly cache: VerdictCacheService
  ) {}

  async findActiveRuleSet(
    at: Date = new Date()
  ): Promise<RuleSetDocument | null> {
    return this.ruleSets
      .findOne({
        effective_from: { $lte: at },
        $or: [{ effective_to: null }, { effective_to: { $gt: at } }],
      })
      .sort({ effective_from: -1 })
      .exec();
  }

  async factsForVersion(
    version: ProductVersion
  ): Promise<Record<string, unknown>> {
    const ids = canonicalIdsFromVersion(version);
    const docs =
      ids.length === 0
        ? []
        : await this.ingredients.find({ _id: { $in: ids } }).exec();
    const categories = docs.map((doc) => doc.category);
    return factsFromVersion(version, categories);
  }

  evaluate(
    facts: Record<string, unknown>,
    ruleSet: RuleSetDocument
  ): EvaluationResult {
    return evaluateRules(facts, ruleSet.rules);
  }

  /**
   * @param preloadedRuleSet Pass this when the caller already fetched the
   * active rule set for its own purposes (e.g. to build a cache key before
   * deciding whether it even needs to call this method) — avoids querying
   * rule_sets twice for the same lookup.
   */
  async ensureScoringRecord(
    version: ProductVersionDocument,
    preloadedRuleSet?: RuleSetDocument
  ): Promise<{
    facts: Record<string, unknown>;
    record: ScoringRecordDocument;
    evaluation: EvaluationResult;
    ruleSetVersion: string;
    unresolved_ingredients: string[];
    confidence: ExtractionConfidence;
  }> {
    const facts = await this.factsForVersion(version);
    const coverage = confidenceForVersion(version);
    const ruleSet = preloadedRuleSet ?? (await this.activeRuleSet());

    // Same (product_version_id, rule_set_version) returns the stored record;
    // a new rule set version inserts another row and leaves the old one.
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
          unevaluated: existing.unevaluated,
        },
        ruleSetVersion: ruleSet.version,
        ...coverage,
      };
    }

    const evaluation = this.evaluate(facts, ruleSet);
    const created = await this.scoringRecords.create({
      product_version_id: version._id,
      rule_set_version: ruleSet.version,
      severity: evaluation.severity,
      breakdown: evaluation.breakdown,
      unevaluated: evaluation.unevaluated,
    });
    return {
      facts,
      record: created,
      evaluation,
      ruleSetVersion: ruleSet.version,
      ...coverage,
    };
  }

  /**
   * The objective (non-personalized) verdict for a live product version,
   * Redis-cached by (barcode, product_version_id, rule_set_version). Single
   * home for the "fetch active rule set → check cache → compute on miss →
   * cache the result" dance, so every caller (product lookup, scan
   * creation, anything else later) gets identical caching behavior instead
   * of each reimplementing it.
   */
  async getCachedObjectiveVerdict(
    version: ProductVersionDocument
  ): Promise<ObjectiveVerdict> {
    const ruleSet = await this.activeRuleSet();

    const versionId = version.id as string;
    const cached = await this.cache.get(
      version.barcode,
      versionId,
      ruleSet.version
    );
    const rule_labels = ruleLabels(ruleSet.rules);
    if (cached) {
      return { ...cached, rule_labels };
    }

    const scored = await this.ensureScoringRecord(version, ruleSet);
    const fresh: CachedObjectiveVerdict = {
      facts: scored.facts,
      severity: scored.evaluation.severity,
      breakdown: scored.evaluation.breakdown,
      unresolved_ingredients: scored.unresolved_ingredients,
      confidence: scored.confidence,
      unevaluated: scored.evaluation.unevaluated,
      rule_set_version: ruleSet.version,
    };
    await this.cache.set(version.barcode, versionId, ruleSet.version, fresh);
    return { ...fresh, rule_labels };
  }

  /** Scoring with no rules would make everything look green — refuse. */
  private async activeRuleSet(): Promise<RuleSetDocument> {
    try {
      return requireActiveRuleSet(await this.findActiveRuleSet());
    } catch {
      throw new ServiceUnavailableException(MISSING_ACTIVE_RULE_SET);
    }
  }
}

function ruleLabels(rules: RuleSet["rules"]): Record<string, string> {
  return Object.fromEntries(
    rules.flatMap((rule) => (rule.label ? [[rule.id, rule.label]] : []))
  );
}
