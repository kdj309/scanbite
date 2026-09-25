import { Injectable } from "@nestjs/common";
import { verdictCacheKey } from "@foodscanner/shared";
import type { ScoringBreakdownItem } from "../scoring/evaluate-rules";

export type CachedObjectiveVerdict = {
  product: {
    name: string;
    brand: string;
    product_version_id: string;
  };
  facts: Record<string, unknown>;
  severity: "green" | "yellow" | "red";
  breakdown: ScoringBreakdownItem[];
  unresolved_ingredients: string[];
  confidence: "full" | "partial" | "low";
};

@Injectable()
export class VerdictCacheService {
  private readonly store = new Map<string, CachedObjectiveVerdict>();

  get(barcode: string, productVersionId: string): CachedObjectiveVerdict | undefined {
    return this.store.get(verdictCacheKey(barcode, productVersionId));
  }

  set(
    barcode: string,
    productVersionId: string,
    value: CachedObjectiveVerdict,
  ): void {
    this.store.set(verdictCacheKey(barcode, productVersionId), value);
  }
}
