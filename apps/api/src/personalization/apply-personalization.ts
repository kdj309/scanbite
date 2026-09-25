import type { RuleOperator } from "../database/schemas/rule-set.schema";
import type { Severity } from "../database/schemas/scoring-record.schema";
import {
  escalateOneLevel,
  operatorMatches,
  readFact,
  worstSeverity,
  type EvaluationResult,
} from "../scoring/evaluate-rules";

export type PersonalizationRuleInput = {
  condition: string;
  trigger: string;
  effect: string;
  message: string;
};

const TRIGGER_RE = /^([A-Za-z0-9_]+)\s*(>=|<=|==|>|<)\s*(.+)$/;

export function parseTrigger(trigger: string): {
  field: string;
  operator: RuleOperator;
  value: unknown;
  threshold?: number;
} | null {
  const match = trigger.trim().match(TRIGGER_RE);
  if (!match) {
    return null;
  }
  const [, field, operator, rawValue] = match;
  const trimmed = rawValue.trim();
  const asNumber = Number(trimmed);
  if (trimmed !== "" && Number.isFinite(asNumber)) {
    return {
      field,
      operator: operator as RuleOperator,
      value: asNumber,
      threshold: asNumber,
    };
  }
  return {
    field,
    operator: operator as RuleOperator,
    value: trimmed.replace(/^['"]|['"]$/g, ""),
  };
}

export function conditionMatches(
  memberConditions: string[],
  condition: string,
): boolean {
  const needle = condition.trim().toLowerCase();
  return memberConditions.some((item) => item.trim().toLowerCase() === needle);
}

export type PersonalizedVerdict = {
  severity: Severity;
  reasons: string[];
};

export function applyPersonalization(input: {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  memberConditions: string[];
  rules: PersonalizationRuleInput[];
}): PersonalizedVerdict {
  const reasons = input.base.breakdown.map((item) => item.reason);
  const overlaySeverities: Severity[] = [];

  for (const rule of input.rules) {
    if (!conditionMatches(input.memberConditions, rule.condition)) {
      continue;
    }
    const trigger = parseTrigger(rule.trigger);
    if (!trigger) {
      continue;
    }
    const fact = readFact(input.facts, trigger.field);
    if (
      !operatorMatches(trigger.operator, fact, trigger.threshold, trigger.value)
    ) {
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
  };
}
