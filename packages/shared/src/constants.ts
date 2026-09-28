/** Redis cache key for a scored live product version (HLD §5.1 / §8). */
export const VERDICT_CACHE_KEY_PREFIX = "verdict";

/**
 * Includes rule_set_version so a rule content change (a new active version)
 * naturally misses the cache instead of serving a verdict computed under
 * stale rules — no explicit invalidation needed for that case.
 */
export function verdictCacheKey(
  barcode: string,
  productVersionId: string,
  ruleSetVersion: string
): string {
  return `${VERDICT_CACHE_KEY_PREFIX}:${barcode}:${productVersionId}:${ruleSetVersion}`;
}

/** Matches every rule_set_version variant cached for one product version. */
export function verdictCacheKeyPattern(
  barcode: string,
  productVersionId: string
): string {
  return `${VERDICT_CACHE_KEY_PREFIX}:${barcode}:${productVersionId}:*`;
}

export const API_VERSION_PREFIX = "/v1";
