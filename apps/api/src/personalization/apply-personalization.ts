import type { HealthConditionCode, VerdictReason } from "@foodscanner/shared";
import type {
  ProductForm,
  RuleOperator,
} from "../database/schemas/rule-set.schema";
import type { Severity } from "../database/schemas/scoring-record.schema";
import {
  checkOperator,
  escalateOneLevel,
  readFact,
  ruleAppliesToForm,
  worstSeverity,
  type EvaluationResult,
} from "../scoring/evaluate-rules";

export type PersonalizationRuleInput = {
  id: string;
  condition: HealthConditionCode;
  field: string;
  operator: RuleOperator;
  threshold?: number;
  value?: unknown;
  effect: string;
  message: string;
  label?: string;
  applies_to?: ProductForm;
};

/** Chip text when a rule has no `label` of its own. */
export const FALLBACK_LABEL = { flag: "Flagged", unchecked: "Couldn't check" };

export function conditionMatches(
  memberConditions: string[],
  condition: string
): boolean {
  const needle = condition.trim().toLowerCase();
  return memberConditions.some((item) => item.trim().toLowerCase() === needle);
}

/** A personalization rule that DID apply to this member (condition
 *  matched) but whose trigger fact was missing — we could not determine
 *  whether it should have fired. Distinct from a rule whose condition
 *  simply didn't apply to this member at all. */
export type PersonalizationUnevaluated = {
  condition: HealthConditionCode;
  field: string;
  rule_id: string;
  label?: string;
};

export type PersonalizedVerdict = {
  severity: Severity;
  /** Only the member's condition rules that matched; base flags stay in
   *  `base.breakdown` (see buildVerdictReasons for the merged list). */
  flags: VerdictReason[];
  unevaluated: PersonalizationUnevaluated[];
};

export function applyPersonalization(input: {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  memberConditions: string[];
  rules: PersonalizationRuleInput[];
}): PersonalizedVerdict {
  const flags: VerdictReason[] = [];
  const overlaySeverities: Severity[] = [];
  const unevaluated: PersonalizationUnevaluated[] = [];

  for (const rule of input.rules) {
    if (!conditionMatches(input.memberConditions, rule.condition)) {
      continue; // rule doesn't apply to this member at all — not a data gap
    }
    if (!ruleAppliesToForm(rule, readFact(input.facts, "product_form"))) {
      continue; // e.g. the per-100g sugar rule on a drink — its twin covers it
    }
    const fact = readFact(input.facts, rule.field);
    const result = checkOperator(
      rule.operator,
      fact,
      rule.threshold,
      rule.value
    );

    if (result === "inapplicable") {
      // This condition DOES apply to the member, and we genuinely could
      // not check whether it should have escalated. Silence here is the
      // riskier failure mode than for base scoring — this is specifically
      // about a health condition the member actually has.
      unevaluated.push({
        condition: rule.condition,
        field: rule.field,
        rule_id: rule.id,
        label: rule.label,
      });
      continue;
    }

    if (result !== "matched") {
      continue;
    }

    // An escalating rule's reason carries the level it escalated to, so it
    // can be the main reason for the verdict it caused.
    const severity = rule.effect.toLowerCase().includes("escalate")
      ? escalateOneLevel(input.base.severity)
      : input.base.severity;
    overlaySeverities.push(severity);
    if (rule.message.trim()) {
      flags.push({
        kind: "flag",
        severity,
        label: rule.label?.trim() || FALLBACK_LABEL.flag,
        text: rule.message,
        rule_id: rule.id,
      });
    }
  }

  return {
    severity: worstSeverity([input.base.severity, ...overlaySeverities]),
    flags,
    unevaluated,
  };
}
