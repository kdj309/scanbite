import type { Severity } from "../database/schemas/scoring-record.schema";
import type { RuleOperator } from "../database/schemas/rule-set.schema";

export const SEVERITY_RANK: Record<Severity, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

export type RuleInput = {
  id: string;
  field: string;
  operator: RuleOperator;
  threshold?: number;
  value?: unknown;
  severity: Severity;
  reason?: string;
};

export type ScoringBreakdownItem = {
  rule_id: string;
  field: string;
  matched_value: unknown;
  severity: Severity;
  reason: string;
};

export type EvaluationResult = {
  severity: Severity;
  breakdown: ScoringBreakdownItem[];
};

export function worstSeverity(severities: Severity[]): Severity {
  let worst: Severity = "green";
  for (const severity of severities) {
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) {
      worst = severity;
    }
  }
  return worst;
}

export function escalateOneLevel(severity: Severity): Severity {
  if (severity === "green") {
    return "yellow";
  }
  if (severity === "yellow") {
    return "red";
  }
  return "red";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function readFact(
  facts: Record<string, unknown>,
  field: string,
): unknown {
  return facts[field];
}

export function operatorMatches(
  operator: RuleOperator,
  fact: unknown,
  threshold: number | undefined,
  value: unknown,
): boolean {
  if (operator === "contains") {
    const needle = String(value ?? "");
    if (Array.isArray(fact)) {
      return fact.map((item) => String(item)).includes(needle);
    }
    if (typeof fact === "string") {
      return fact.includes(needle);
    }
    return false;
  }

  const left = asNumber(fact);
  const right =
    threshold !== undefined && Number.isFinite(threshold)
      ? threshold
      : asNumber(value);
  if (left === undefined || right === undefined) {
    if (operator === "==") {
      return fact === value || String(fact) === String(value);
    }
    return false;
  }

  switch (operator) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    default:
      return false;
  }
}

function defaultReason(rule: RuleInput): string {
  const rhs =
    rule.threshold !== undefined ? String(rule.threshold) : String(rule.value);
  return `${rule.field} ${rule.operator} ${rhs}`;
}

export function evaluateRules(
  facts: Record<string, unknown>,
  rules: RuleInput[],
): EvaluationResult {
  const breakdown: ScoringBreakdownItem[] = [];

  for (const rule of rules) {
    const matchedValue = readFact(facts, rule.field);
    if (
      !operatorMatches(rule.operator, matchedValue, rule.threshold, rule.value)
    ) {
      continue;
    }
    breakdown.push({
      rule_id: rule.id,
      field: rule.field,
      matched_value: matchedValue,
      severity: rule.severity,
      reason: rule.reason?.trim() ? rule.reason : defaultReason(rule),
    });
  }

  return {
    severity: worstSeverity(breakdown.map((item) => item.severity)),
    breakdown,
  };
}
