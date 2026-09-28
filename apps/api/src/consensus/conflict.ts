export const AUTO_PROMOTE_CONFIDENCE = 0.9;

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
}): boolean {
  if (!input.hasLiveVersion) {
    return true;
  }
  return input.extractionConfidence >= AUTO_PROMOTE_CONFIDENCE;
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
