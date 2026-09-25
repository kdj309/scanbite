/** Redis cache key for a scored live product version (HLD §5.1 / §8). */
export const VERDICT_CACHE_KEY_PREFIX = "verdict";

export function verdictCacheKey(
  barcode: string,
  productVersionId: string,
): string {
  return `${VERDICT_CACHE_KEY_PREFIX}:${barcode}:${productVersionId}`;
}

export const API_VERSION_PREFIX = "/v1";
