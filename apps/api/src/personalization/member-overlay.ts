import {
  HEALTH_CONDITION_LABELS,
  type FlagReason,
  type HealthConditionCode,
  type UncheckedReason,
} from "@foodscanner/shared";
import type { Severity } from "../database/schemas/rule-set.schema";
import { worstSeverity } from "../scoring/evaluate-rules";

/**
 * What one member-specific check (their conditions, their allergies) adds
 * on top of the general verdict: its severity and finished reasons.
 * buildVerdictReasons merges these with the general flags and orders them.
 */
export type MemberOverlay = {
  severity: Severity;
  flags: FlagReason[];
  unchecked: UncheckedReason[];
  /** Topics checked and passed for them ("What we checked"). */
  checked: TopicCheck[];
  /** Topics flagged for them — these never show as checked. */
  flaggedTopics: string[];
};

/** One passed check, before grouping: topic "Sugar", for "diabetes". */
export type TopicCheck = { topic: string; for?: string };

export function combineOverlays(...overlays: MemberOverlay[]): MemberOverlay {
  return {
    severity: worstSeverity(overlays.map((overlay) => overlay.severity)),
    flags: overlays.flatMap((overlay) => overlay.flags),
    unchecked: overlays.flatMap((overlay) => overlay.unchecked),
    checked: overlays.flatMap((overlay) => overlay.checked),
    flaggedTopics: overlays.flatMap((overlay) => overlay.flaggedTopics),
  };
}

/**
 * What a rule is about, as one word for "What we checked". Ingredient rules
 * are named by their own label ("Palm oil"), so different ones stay apart.
 */
export function checkTopic(field: string, label?: string): string {
  const known = NUTRITION_FACTS[field]?.topic;
  if (known) {
    return known;
  }
  const name = label?.trim() || factName(field);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Chip text when a rule has no `label` of its own. */
export const FALLBACK_LABEL = { flag: "Flagged", unchecked: "Couldn't check" };

export function uncheckedReason(
  text: string,
  ruleId: string,
  label: string | undefined
): UncheckedReason {
  return {
    kind: "unchecked",
    label: label?.trim() || FALLBACK_LABEL.unchecked,
    text,
    rule_id: ruleId,
  };
}

/**
 * Everything we say about each nutrition fact, in one place: its topic in
 * "What we checked", its name inside a sentence, and (for sugar and salt)
 * the unit better-options meters use.
 */
export const NUTRITION_FACTS: Record<
  string,
  { topic: string; inText: string; unit?: "g" | "mg" }
> = {
  sugar_per_100g: { topic: "Sugar", inText: "sugar", unit: "g" },
  sugar_per_100ml: { topic: "Sugar", inText: "sugar", unit: "g" },
  sodium_per_100g: { topic: "Salt", inText: "salt", unit: "mg" },
  sodium_per_100ml: { topic: "Salt", inText: "salt", unit: "mg" },
  additive_count: { topic: "Additives", inText: "additives" },
  nova_group: { topic: "Processing", inText: "how processed it is" },
};

/** "sugar_per_100ml" -> "sugar", for plain-words gap text. */
export function factName(field: string): string {
  return NUTRITION_FACTS[field]?.inText ?? field.replace(/_/g, " ");
}

/** "Diabetes" -> "diabetes", but "PCOS" stays "PCOS". */
export function conditionName(code: HealthConditionCode): string {
  const label = HEALTH_CONDITION_LABELS[code];
  return label === label.toUpperCase() ? label : label.toLowerCase();
}
