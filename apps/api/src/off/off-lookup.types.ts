import type { OffExtraction } from "./off-extraction";

/** What a lookup leaves in Redis: an extraction, or a known miss. */
export type CachedLookup =
  { found: true; extraction: OffExtraction } | { found: false };

/**
 * Three outcomes, not found/not-found: a transient failure must never be
 * cached like OFF genuinely not having the barcode, or a brand-new barcode
 * would look unknown for hours after a blip OFF recovers from in seconds.
 */
export type OffLookupResult =
  | { kind: "found"; extraction: OffExtraction }
  | { kind: "not_found" }
  | { kind: "error" };
