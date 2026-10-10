import type { FlagReason, HealthConditionCode } from "@foodscanner/shared";
import type {
  ProductForm,
  RuleOperator,
} from "../database/schemas/rule-set.schema";
import type { PersonalizationEffect } from "../database/schemas/personalization-rule.schema";
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
  effect: PersonalizationEffect;
  message: string;
  label?: string;
  applies_to?: ProductForm;
};

/** Chip text when a rule has no `label` of its own. */
export const FALLBACK_LABEL = { flag: "Flagged", unchecked: "Couldn't check" };

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
  flags: FlagReason[];
  unevaluated: PersonalizationUnevaluated[];
};

export function applyPersonalization(input: {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  memberConditions: HealthConditionCode[];
  rules: PersonalizationRuleInput[];
}): PersonalizedVerdict {
  const flags: FlagReason[] = [];
  const unevaluated: PersonalizationUnevaluated[] = [];
  const productForm = readFact(input.facts, "product_form");

  for (const rule of input.rules) {
    if (!input.memberConditions.includes(rule.condition)) {
      continue; // rule doesn't apply to this member at all — not a data gap
    }
    if (!ruleAppliesToForm(rule, productForm)) {
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

    // "escalate one level" is the only effect. The reason carries the level
    // it escalated to, so it can be the main reason for the verdict it
    // caused — and every escalation gets one.
    flags.push({
      kind: "flag",
      severity: escalateOneLevel(input.base.severity),
      label: rule.label?.trim() || FALLBACK_LABEL.flag,
      text: rule.message,
      rule_id: rule.id,
    });
  }

  return {
    severity: worstSeverity([
      input.base.severity,
      ...flags.map((flag) => flag.severity),
    ]),
    flags,
    unevaluated,
  };
}
