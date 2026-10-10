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
};

export function combineOverlays(...overlays: MemberOverlay[]): MemberOverlay {
  return {
    severity: worstSeverity(overlays.map((overlay) => overlay.severity)),
    flags: overlays.flatMap((overlay) => overlay.flags),
    unchecked: overlays.flatMap((overlay) => overlay.unchecked),
  };
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

const FACT_NAMES: Record<string, string> = {
  sugar_per_100g: "sugar",
  sugar_per_100ml: "sugar",
  sodium_per_100g: "salt",
  sodium_per_100ml: "salt",
  additive_count: "additives",
  nova_group: "how processed it is",
};

/** "sugar_per_100ml" -> "sugar", for plain-words gap text. */
export function factName(field: string): string {
  return FACT_NAMES[field] ?? field.replace(/_/g, " ");
}

/** "Diabetes" -> "diabetes", but "PCOS" stays "PCOS". */
export function conditionName(code: HealthConditionCode): string {
  const label = HEALTH_CONDITION_LABELS[code];
  return label === label.toUpperCase() ? label : label.toLowerCase();
}
