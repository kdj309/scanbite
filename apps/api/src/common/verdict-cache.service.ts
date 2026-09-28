import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verdictCacheKey, verdictCacheKeyPattern } from "@foodscanner/shared";
import type { Env } from "../config/env";
import type {
  ScoringBreakdownItem,
  UnevaluatedRule,
} from "../scoring/evaluate-rules";
import { RedisCacheService } from "./redis-cache.service";

export type CachedObjectiveVerdict = {
  product: {
    name: string;
    brand: string;
    product_version_id: string;
  };
  facts: Record<string, unknown>;
  unevaluated: UnevaluatedRule[];
  severity: "green" | "yellow" | "red";
  breakdown: ScoringBreakdownItem[];
  unresolved_ingredients: string[];
  confidence: "full" | "partial" | "low";
  rule_set_version: string;
};

@Injectable()
export class VerdictCacheService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisCache: RedisCacheService,
    config: ConfigService<Env, true>
  ) {
    this.ttlSeconds = config.get("VERDICT_CACHE_TTL_SECONDS", { infer: true });
  }

  get(
    barcode: string,
    productVersionId: string,
    ruleSetVersion: string
  ): Promise<CachedObjectiveVerdict | undefined> {
    return this.redisCache.getJson<CachedObjectiveVerdict>(
      verdictCacheKey(barcode, productVersionId, ruleSetVersion)
    );
  }

  set(
    barcode: string,
    productVersionId: string,
    ruleSetVersion: string,
    value: CachedObjectiveVerdict
  ): Promise<void> {
    return this.redisCache.setJson(
      verdictCacheKey(barcode, productVersionId, ruleSetVersion),
      value,
      this.ttlSeconds
    );
  }

  /**
   * Drops every cached verdict for this product version, across all
   * rule_set_version variants. A rule-content change never needs this (the
   * versioned key already misses on its own) — this is for when the
   * product version's OWN data changes under the same rule_set_version,
   * e.g. a rescore job recomputing facts.
   */
  invalidateVersion(barcode: string, productVersionId: string): Promise<void> {
    return this.redisCache.deleteByPattern(
      verdictCacheKeyPattern(barcode, productVersionId)
    );
  }
}
