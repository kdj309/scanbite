import type { HealthConditionCode } from "@foodscanner/shared";
import type { RuleOperator } from "../database/schemas/rule-set.schema";
import type { Severity } from "../database/schemas/scoring-record.schema";
import {
  checkOperator,
  escalateOneLevel,
  readFact,
  worstSeverity,
  type EvaluationResult,
} from "../scoring/evaluate-rules";

export type PersonalizationRuleInput = {
  condition: HealthConditionCode;
  field: string;
  operator: RuleOperator;
  threshold?: number;
  value?: unknown;
  effect: string;
  message: string;
};

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
  condition: string;
  field: string;
  reason: string;
};

export type PersonalizedVerdict = {
  severity: Severity;
  reasons: string[];
  unevaluated: PersonalizationUnevaluated[];
};

export function applyPersonalization(input: {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  memberConditions: string[];
  rules: PersonalizationRuleInput[];
}): PersonalizedVerdict {
  const reasons = input.base.breakdown.map((item) => item.reason);
  const overlaySeverities: Severity[] = [];
  const unevaluated: PersonalizationUnevaluated[] = [];

  for (const rule of input.rules) {
    if (!conditionMatches(input.memberConditions, rule.condition)) {
      continue; // rule doesn't apply to this member at all — not a data gap
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
        reason: `Could not check ${rule.field} for your ${rule.condition} profile — data unavailable`,
      });
      continue;
    }

    if (result !== "matched") {
      continue;
    }

    if (rule.effect.toLowerCase().includes("escalate")) {
      overlaySeverities.push(escalateOneLevel(input.base.severity));
    }
    if (rule.message.trim()) {
      reasons.push(rule.message);
    }
  }

  return {
    severity: worstSeverity([input.base.severity, ...overlaySeverities]),
    reasons,
    unevaluated,
  };
}
