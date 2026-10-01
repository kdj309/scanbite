import { Injectable, Logger } from "@nestjs/common";
import { fetchWithTimeout } from "../common/fetch-with-timeout";
import { RedisCacheService } from "../common/redis-cache.service";
import { mapOffProduct } from "./off-mapper";
import type { OffExtraction, OffProductPayload } from "./off-extraction";

const OFF_FIELDS = [
  "product_name",
  "brands",
  "categories",
  "categories_tags",
  "ingredients_text",
  "ingredients",
  "nutriments",
  "nova_group",
  "additives_n",
  "states_tags",
  "data_quality_errors_tags",
  "quantity",
  "product_quantity_unit",
].join(",");

/** Identifies the app to OFF per their API usage guidelines, not an auth credential. */
const USER_AGENT = "ScanBite/1.0 (+https://github.com/kdj309/scanbite)";

const CACHE_PREFIX = "off:product";
const FOUND_TTL_SECONDS = 24 * 60 * 60;
const NOT_FOUND_TTL_SECONDS = 6 * 60 * 60;

type CachedLookup =
  { found: true; extraction: OffExtraction } | { found: false };

/**
 * Three distinct outcomes, not a binary found/not-found — a transient
 * failure (OFF down, network blip, timeout) must never be cached the same
 * way as OFF genuinely not having the barcode. Caching a transient failure
 * as "not found" for NOT_FOUND_TTL_SECONDS would make a brand-new barcode
 * look permanently unknown for hours after a blip that OFF itself recovers
 * from in seconds.
 */
type OffFetchResult =
  | { kind: "found"; extraction: OffExtraction }
  | { kind: "not_found" }
  | { kind: "error" };

@Injectable()
export class OffLookupService {
  private readonly logger = new Logger(OffLookupService.name);

  constructor(private readonly cache: RedisCacheService) {}

  async lookup(barcode: string): Promise<OffExtraction | null> {
    const cacheKey = `${CACHE_PREFIX}:${barcode}`;
    const cached = await this.cache.getJson<CachedLookup>(cacheKey);
    if (cached) {
      return cached.found ? cached.extraction : null;
    }

    const result = await this.fetchFromOff(barcode);
    if (result.kind === "error") {
      // Don't poison the cache on a transient failure — let the next
      // lookup try OFF again instead of treating this as a known miss.
      return null;
    }

    const toCache: CachedLookup =
      result.kind === "found"
        ? { found: true, extraction: result.extraction }
        : { found: false };
    await this.cache.setJson(
      cacheKey,
      toCache,
      result.kind === "found" ? FOUND_TTL_SECONDS : NOT_FOUND_TTL_SECONDS
    );
    return result.kind === "found" ? result.extraction : null;
  }

  private async fetchFromOff(barcode: string): Promise<OffFetchResult> {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode
    )}.json?fields=${OFF_FIELDS}`;

    let payload: OffProductPayload;
    try {
      const response = await fetchWithTimeout(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) {
        this.logger.warn(
          `OFF lookup for ${barcode} returned HTTP ${response.status}`
        );
        return { kind: "error" };
      }
      payload = (await response.json()) as OffProductPayload;
    } catch (error) {
      this.logger.warn(
        `OFF lookup for ${barcode} failed: ${(error as Error).message}`
      );
      return { kind: "error" };
    }

    if (payload.status !== 1 || !payload.product) {
      return { kind: "not_found" };
    }

    const extraction = mapOffProduct(payload.product);
    return extraction ? { kind: "found", extraction } : { kind: "not_found" };
  }
}
