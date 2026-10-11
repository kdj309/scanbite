import type {
  FlagReason,
  HealthConditionCode,
  UncheckedReason,
} from "@foodscanner/shared";
import type {
  ProductForm,
  RuleOperator,
} from "../database/schemas/rule-set.schema";
import type { PersonalizationEffect } from "../database/schemas/personalization-rule.schema";
import {
  checkOperator,
  escalateOneLevel,
  readFact,
  ruleAppliesToForm,
  worstSeverity,
  type EvaluationResult,
} from "../scoring/evaluate-rules";
import {
  FALLBACK_LABEL,
  checkTopic,
  conditionName,
  factName,
  uncheckedReason,
  type MemberOverlay,
  type TopicCheck,
} from "./member-overlay";

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

export function applyPersonalization(input: {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  memberConditions: HealthConditionCode[];
  rules: PersonalizationRuleInput[];
}): MemberOverlay {
  const flags: FlagReason[] = [];
  const unchecked: UncheckedReason[] = [];
  const checked: TopicCheck[] = [];
  const flaggedTopics: string[] = [];
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
      unchecked.push(
        uncheckedReason(
          `Couldn't check ${factName(rule.field)} for ${conditionName(rule.condition)}`,
          rule.id,
          rule.label
        )
      );
      continue;
    }

    if (result !== "matched") {
      checked.push({
        topic: checkTopic(rule.field),
        for: conditionName(rule.condition),
      });
      continue;
    }
    flaggedTopics.push(checkTopic(rule.field));

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
    unchecked,
    checked,
    flaggedTopics,
  };
}
