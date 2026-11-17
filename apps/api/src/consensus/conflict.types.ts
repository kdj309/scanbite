import type { Nutrition } from "@foodscanner/shared";

/** What two reads of a label are compared on. */
export type VersionSnapshot = {
  name: string;
  brand: string;
  nutrition: Nutrition;
  resolvedCanonicalIds: string[];
  unresolvedRaw: string[];
  extraction_confidence: number;
};

export type ExtractionPlan = { kind: "reuse_live" } | { kind: "pending" };

/** Enough of a read to tell whether two reads are the same pack. */
export type PackIdentity = {
  brand: string;
  name: string;
};

/** A read of a pack, with how many ingredients it found. */
export type PackRead = PackIdentity & {
  ingredientCount: number;
};

/** New photos' read of a pack, with how sure the extraction was. */
export type IncomingPackRead = PackRead & {
  extractionConfidence: number;
};

export type AutoPromoteInput = {
  hasLiveVersion: boolean;
  extractionConfidence: number;
  /** See fillsNoResult: treated like a first read of the product. */
  fillsNoResult?: boolean;
};

export type ExtractionPlanInput = {
  live: VersionSnapshot | null;
  incoming: VersionSnapshot;
};
