export const AUTO_PROMOTE_CONFIDENCE = 0.9;

/**
 * "Scan the label again" goes live from this confidence; below it, review.
 * Clear reads have scored 0.8-0.9 and blurry ones 0.5, and a wrong "Safe"
 * is worse than "No result".
 */
export const FILL_NO_RESULT_CONFIDENCE = 0.7;

/** The fewest letters a partly read brand needs to match a fuller one. */
const MIN_BRAND_PREFIX = 3;

/**
 * Vision-LLM re-reads of the same label are noisy — tolerate that noise as
 * a percentage of the value rather than a flat number, since nutrients live
 * on very different scales (sugar in single/double-digit grams, sodium in
 * hundreds of milligrams). A flat absolute band tuned for sugar would be
 * near-zero tolerance for sodium and flag routine re-read noise as a
 * product conflict.
 */
export const NUTRITION_RELATIVE_TOLERANCE = 0.07;

/** Floor for the tolerance band near zero, where a % of the value would
 *  collapse to ~0 and treat trace-level noise as a meaningful jump. */
export const NUTRITION_ABS_FLOOR = 0.5;

export type VersionSnapshot = {
  name: string;
  brand: string;
  nutrition: Record<string, number | string | null>;
  resolvedCanonicalIds: string[];
  unresolvedRaw: string[];
  extraction_confidence: number;
};

export type ExtractionPlan = { kind: "reuse_live" } | { kind: "pending" };

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function nutritionNumber(
  nutrition: Record<string, number | string | null>,
  key: string
): number | undefined {
  const raw = nutrition[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function sortedUnique(values: string[]): string {
  return [...new Set(values)].sort().join("|");
}

function withinTolerance(left: number, right: number): boolean {
  const reference = Math.max(Math.abs(left), Math.abs(right));
  const allowed = Math.max(
    NUTRITION_ABS_FLOOR,
    reference * NUTRITION_RELATIVE_TOLERANCE
  );
  return Math.abs(left - right) <= allowed;
}

function nutritionConflicts(
  live: Record<string, number | string | null>,
  incoming: Record<string, number | string | null>
): boolean {
  const keys = new Set([...Object.keys(live), ...Object.keys(incoming)]);
  for (const key of keys) {
    const left = nutritionNumber(live, key);
    const right = nutritionNumber(incoming, key);
    if (left === undefined && right === undefined) {
      continue;
    }
    if (left === undefined || right === undefined) {
      return true;
    }
    if (!withinTolerance(left, right)) {
      return true;
    }
  }
  return false;
}

function ingredientSetsConflict(
  live: VersionSnapshot,
  incoming: VersionSnapshot
): boolean {
  if (
    sortedUnique(live.resolvedCanonicalIds) !==
    sortedUnique(incoming.resolvedCanonicalIds)
  ) {
    return true;
  }
  return (
    sortedUnique(live.unresolvedRaw.map(normalize)) !==
    sortedUnique(incoming.unresolvedRaw.map(normalize))
  );
}

export function versionsConflict(
  live: VersionSnapshot,
  incoming: VersionSnapshot
): boolean {
  if (normalize(live.name) !== normalize(incoming.name)) {
    return true;
  }
  if (normalize(live.brand) !== normalize(incoming.brand)) {
    return true;
  }
  if (nutritionConflicts(live.nutrition, incoming.nutrition)) {
    return true;
  }
  return ingredientSetsConflict(live, incoming);
}

/**
 * v1 promote signal is this submission's vision confidence, not
 * confidence-weighted consensus across independent confirmers (HLD §6c).
 * Live versions also have no confirmation count yet — every live row is
 * equally easy to supersede once confidence clears the threshold.
 */
export function shouldAutoPromote(input: {
  hasLiveVersion: boolean;
  extractionConfidence: number;
  /** See fillsNoResult: treated like a first read of the product. */
  fillsNoResult?: boolean;
}): boolean {
  if (!input.hasLiveVersion || input.fillsNoResult) {
    return true;
  }
  return input.extractionConfidence >= AUTO_PROMOTE_CONFIDENCE;
}

function brandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Same brand, allowing for a read that caught only part of it ("SWAS" on
 * a blurry pack, "SWASTIKS" on a clear one) if at least 3 letters were
 * read. "unknown" (not visible on the photos) can't rule anything out.
 */
export function sameBrand(left: string, right: string): boolean {
  const a = brandKey(left);
  const b = brandKey(right);
  if (a === "unknown" || b === "unknown") {
    return true;
  }
  if (a === "" || b === "") {
    return false;
  }
  if (a === b) {
    return true;
  }
  return (
    Math.min(a.length, b.length) >= MIN_BRAND_PREFIX &&
    (a.startsWith(b) || b.startsWith(a))
  );
}

/**
 * The same pack even when the two reads name the brand differently: a
 * company on one ("Sunfeast") and its product line on the other ("Mom's
 * Magic"), where that line is part of the other read's product name.
 */
export function samePack(
  left: { brand: string; name: string },
  right: { brand: string; name: string }
): boolean {
  return (
    sameBrand(left.brand, right.brand) ||
    brandInName(left.brand, right.name) ||
    brandInName(right.brand, left.name)
  );
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * The brand's whole words, in order, inside the name ("Mom's Magic" in
 * "Mom's Magic Ghee Roasted…"), never letters inside another word ("Real"
 * in "Corn Flakes Cereal"). "unknown" (not read) names nothing.
 */
function brandInName(brand: string, name: string): boolean {
  const brandWords = words(brand);
  const nameWords = words(name);
  if (
    brandWords.join("").length < MIN_BRAND_PREFIX ||
    brandKey(brand) === "unknown" ||
    brandKey(name) === "unknown"
  ) {
    return false;
  }
  return nameWords.some((_, start) =>
    brandWords.every((word, i) => nameWords[start + i] === word)
  );
}

/**
 * "Scan the label again" (design 2c): the live version has no ingredients,
 * so there was no verdict, and these photos read some from what looks like
 * the same product. The new version replaces it whole, never merged into
 * it (merging two photo sets can mix two products or recipes).
 */
export function fillsNoResult(
  live: { ingredientCount: number; brand: string; name: string },
  incoming: {
    ingredientCount: number;
    brand: string;
    name: string;
    extractionConfidence: number;
  }
): boolean {
  return (
    live.ingredientCount === 0 &&
    incoming.ingredientCount > 0 &&
    incoming.extractionConfidence >= FILL_NO_RESULT_CONFIDENCE &&
    samePack(live, incoming)
  );
}

export function planAfterExtraction(input: {
  live: VersionSnapshot | null;
  incoming: VersionSnapshot;
}): ExtractionPlan {
  if (!input.live) {
    return { kind: "pending" };
  }
  if (!versionsConflict(input.live, input.incoming)) {
    return { kind: "reuse_live" };
  }
  return { kind: "pending" };
}
