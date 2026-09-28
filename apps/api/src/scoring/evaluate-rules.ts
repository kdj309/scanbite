import type { Severity } from "../database/schemas/scoring-record.schema";
import type {
  ProductForm,
  RuleOperator,
} from "../database/schemas/rule-set.schema";

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
  /** Scopes this rule to solid or liquid products; omitted/"any" = both. */
  applies_to?: ProductForm;
};

/**
 * A rule scoped to the wrong product form (e.g. a per-100ml liquid rule on a
 * solid snack) isn't a data gap — it never applied in the first place, so it
 * must be skipped entirely, not reported as breakdown OR unevaluated.
 */
function ruleAppliesToForm(rule: RuleInput, productForm: unknown): boolean {
  if (!rule.applies_to || rule.applies_to === "any") {
    return true;
  }
  // No product_form fact supplied (e.g. hand-built facts in tests/callers
  // that predate this concept) defaults to "solid", the overwhelmingly
  // common case — factsFromVersion always sets an explicit value in
  // production, so this default never actually applies there.
  if (rule.applies_to === "solid" && productForm === undefined) {
    return true;
  }
  return rule.applies_to === productForm;
}

export type ScoringBreakdownItem = {
  rule_id: string;
  field: string;
  matched_value: unknown;
  severity: Severity;
  reason: string;
};

/** A rule whose fact was missing — could not be checked at all, distinct
 *  from a rule that WAS checked and simply didn't match. */
export type UnevaluatedRule = {
  rule_id: string;
  field: string;
  reason: string;
};

export type EvaluationResult = {
  severity: Severity;
  breakdown: ScoringBreakdownItem[];
  unevaluated: UnevaluatedRule[];
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
  field: string
): unknown {
  return facts[field];
}

export type RuleCheckResult = "matched" | "not_matched" | "inapplicable";

/**
 * Three-state check, replacing the old boolean operatorMatches.
 * "inapplicable" means the fact needed to evaluate this rule was missing —
 * this must NOT be treated the same as "checked, and it's fine."
 */
export function checkOperator(
  operator: RuleOperator,
  fact: unknown,
  threshold: number | undefined,
  value: unknown
): RuleCheckResult {
  if (operator === "contains") {
    // An empty/missing array for a "contains" check is a legitimate
    // not_matched, not a data gap — ingredient-resolution confidence
    // (facts.ts / confidenceForVersion) already covers "we're not sure
    // what's in this product" as its own, separate signal.
    const needle = String(value ?? "");
    if (Array.isArray(fact)) {
      return fact.map((item) => String(item)).includes(needle)
        ? "matched"
        : "not_matched";
    }
    if (typeof fact === "string") {
      return fact.includes(needle) ? "matched" : "not_matched";
    }
    return "not_matched";
  }

  if (fact === undefined || fact === null) {
    return "inapplicable";
  }

  const left = asNumber(fact);
  const right =
    threshold !== undefined && Number.isFinite(threshold)
      ? threshold
      : asNumber(value);

  if (left === undefined) {
    return "inapplicable";
  }
  if (right === undefined) {
    // Rule config itself is malformed (no usable threshold/value) — that's
    // not a missing-fact situation, so don't report it as a data gap.
    return "not_matched";
  }

  switch (operator) {
    case ">":
      return left > right ? "matched" : "not_matched";
    case ">=":
      return left >= right ? "matched" : "not_matched";
    case "<":
      return left < right ? "matched" : "not_matched";
    case "<=":
      return left <= right ? "matched" : "not_matched";
    case "==":
      return left === right ? "matched" : "not_matched";
    default:
      return "not_matched";
  }
}

/**
 * Backward-compatible boolean wrapper around checkOperator, for existing
 * callers (e.g. personalization's applyPersonalization) that only need a
 * matched/not-matched answer and aren't yet distinguishing missing-fact
 * cases. Treats "inapplicable" as false, same as the old behavior.
 *
 * Note: this means personalization triggers still have the same silent
 * gap evaluateRules used to have — a condition like "sugar_per_100g > 15"
 * won't escalate AND won't flag as unknown when sugar is missing, it'll
 * just quietly not trigger. Worth the same unevaluated-tracking treatment
 * later if personalization needs the same honesty guarantee as base
 * scoring; not fixed here to avoid widening this change further.
 */
export function operatorMatches(
  operator: RuleOperator,
  fact: unknown,
  threshold: number | undefined,
  value: unknown
): boolean {
  return checkOperator(operator, fact, threshold, value) === "matched";
}

function defaultReason(rule: RuleInput): string {
  const rhs =
    rule.threshold !== undefined ? String(rule.threshold) : String(rule.value);
  return `${rule.field} ${rule.operator} ${rhs}`;
}

export function evaluateRules(
  facts: Record<string, unknown>,
  rules: RuleInput[]
): EvaluationResult {
  const breakdown: ScoringBreakdownItem[] = [];
  const unevaluated: UnevaluatedRule[] = [];

  const productForm = readFact(facts, "product_form");

  for (const rule of rules) {
    if (!ruleAppliesToForm(rule, productForm)) {
      continue;
    }
    const matchedValue = readFact(facts, rule.field);
    const result = checkOperator(
      rule.operator,
      matchedValue,
      rule.threshold,
      rule.value
    );

    if (result === "matched") {
      breakdown.push({
        rule_id: rule.id,
        field: rule.field,
        matched_value: matchedValue,
        severity: rule.severity,
        reason: rule.reason?.trim() ? rule.reason : defaultReason(rule),
      });
    } else if (result === "inapplicable") {
      unevaluated.push({
        rule_id: rule.id,
        field: rule.field,
        reason: `${rule.field} unknown — could not evaluate this check`,
      });
    }
  }

  return {
    severity: worstSeverity(breakdown.map((item) => item.severity)),
    breakdown,
    unevaluated,
  };
}
