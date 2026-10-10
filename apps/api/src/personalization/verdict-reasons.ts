import {
  HEALTH_CONDITION_LABELS,
  type FlagReason,
  type HealthConditionCode,
  type UncheckedReason,
  type VerdictReason,
} from "@foodscanner/shared";
import {
  SEVERITY_RANK,
  type EvaluationResult,
} from "../scoring/evaluate-rules";
import {
  FALLBACK_LABEL,
  type PersonalizedVerdict,
} from "./apply-personalization";

/**
 * One ordered list for the app (contract: verdictReasonSchema):
 *  1. flags, worst severity first — on a tie the member's condition rule
 *     comes before a general one (sort is stable and personal flags go in
 *     first), so reasons[0] is the main reason;
 *  2. then "unchecked" gaps: the member's condition gaps always, general
 *     gaps only when the verdict is green (a gap must never hide behind a
 *     "Safe"; next to a flag it adds nothing).
 * `ruleLabels` maps base rule id -> chip text from the active rule set.
 * Gap text is written here, not stored, so it reads as plain words.
 */
export function buildVerdictReasons(input: {
  base: EvaluationResult;
  personalized: PersonalizedVerdict;
  ruleLabels: Record<string, string>;
}): VerdictReason[] {
  const { base, personalized, ruleLabels } = input;

  const generalFlags: FlagReason[] = base.breakdown.map((item) => ({
    kind: "flag",
    severity: item.severity,
    label: ruleLabels[item.rule_id] ?? FALLBACK_LABEL.flag,
    text: item.reason,
    rule_id: item.rule_id,
  }));
  const flags = [...personalized.flags, ...generalFlags].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );

  const unchecked: UncheckedReason[] = [
    ...personalized.unevaluated.map((gap) =>
      uncheckedReason(
        `Couldn't check ${factName(gap.field)} for ${conditionName(gap.condition)}`,
        gap.rule_id,
        gap.label
      )
    ),
    ...(personalized.severity === "green"
      ? base.unevaluated.map((gap) =>
          uncheckedReason(
            `Couldn't check ${factName(gap.field)}`,
            gap.rule_id,
            ruleLabels[gap.rule_id]
          )
        )
      : []),
  ];

  return [...flags, ...unchecked];
}

const FACT_NAMES: Record<string, string> = {
  sugar_per_100g: "sugar",
  sugar_per_100ml: "sugar",
  sodium_per_100g: "salt",
  sodium_per_100ml: "salt",
  additive_count: "additives",
  nova_group: "how processed it is",
};

function factName(field: string): string {
  return FACT_NAMES[field] ?? field.replace(/_/g, " ");
}

/** "Diabetes" -> "diabetes", but "PCOS" stays "PCOS". */
function conditionName(code: HealthConditionCode): string {
  const label = HEALTH_CONDITION_LABELS[code];
  return label === label.toUpperCase() ? label : label.toLowerCase();
}

function uncheckedReason(
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
