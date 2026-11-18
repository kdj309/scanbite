import { Injectable, Logger } from "@nestjs/common";
import { RedisCacheService } from "../common/redis-cache.service";
import type { OffExtraction } from "./off-extraction";
import { fetchOffProduct } from "./off-fetch";
import type { CachedLookup, OffLookupResult } from "./off-lookup.types";
import { mapOffProduct } from "./off-mapper";

const OFF_FIELDS = [
  "product_name",
  "brands",
  "categories",
  "categories_tags",
  "pnns_groups_2",
  "ingredients_text",
  "ingredients",
  "nutriments",
  "nova_group",
  "additives_n",
  "quantity",
  "product_quantity_unit",
  "image_front_url",
  "allergens_tags",
  "traces_tags",
  "labels_tags",
].join(",");

/** Redis key prefix for cached lookups ("off:product:<barcode>"). */
export const OFF_LOOKUP_CACHE_PREFIX = "off:product";
const FOUND_TTL_SECONDS = 24 * 60 * 60;
const NOT_FOUND_TTL_SECONDS = 6 * 60 * 60;

@Injectable()
export class OffLookupService {
  private readonly logger = new Logger(OffLookupService.name);

  constructor(private readonly cache: RedisCacheService) {}

  async lookup(barcode: string): Promise<OffExtraction | null> {
    const cacheKey = `${OFF_LOOKUP_CACHE_PREFIX}:${barcode}`;
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

  /** OFF's product mapped to an extraction; null when OFF can't give one. */
  private async fetchFromOff(barcode: string): Promise<OffLookupResult> {
    const result = await fetchOffProduct(barcode, OFF_FIELDS);
    if (result.kind === "failed") {
      this.logger.warn(`OFF lookup for ${barcode} failed: ${result.reason}`);
      return { kind: "error" };
    }
    const extraction =
      result.kind === "found" ? mapOffProduct(result.product) : null;
    return extraction ? { kind: "found", extraction } : { kind: "not_found" };
  }
}
