import {
  ALLERGEN_LABELS,
  allergenCodeSchema,
  type Improvement,
} from "@foodscanner/shared";
import {
  verdictFor,
  type ProductContext,
} from "../personalization/household-verdict";
import { SEVERITY_RANK } from "../scoring/evaluate-rules";
import { NUTRITION_FACTS, factName } from "../personalization/member-overlay";
import type {
  AlternativeMember,
  RankAlternativesInput,
  RankedCautionAlternative,
  RankKey,
  RemainingIssues,
  RuleFact,
} from "./rank-alternatives.types";

/** Facts with a number we can compare and meter (sugar, salt). */
function meterUnit(field: string): "g" | "mg" | undefined {
  return NUTRITION_FACTS[field]?.unit;
}

/** What each scoring/condition rule checks, from the rule definitions. */
export type RuleFacts = Record<string, RuleFact>;

export type RankedAlternative<T> = { item: T; improvements: Improvement[] };

type NumericProblem = {
  field: string;
  unit: "g" | "mg";
  original: number;
  limit: number;
};

/** One number that flagged the original, measured on a candidate. */
type Meter = NumericProblem & { value: number; drop: number };

/**
 * Better options for `members` (everyone the scanned product isn't Safe
 * for): candidates — already same category and form — that are Safe for
 * every one of them, best first. "Best" = biggest drop in the numbers that
 * flagged the original; a candidate whose number is unknown can't claim to
 * be lower, so it's left out.
 */
export function rankAlternatives<T>(
  input: RankAlternativesInput<T>
): RankedAlternative<T>[] {
  const { original, members, ruleFacts } = input;
  if (members.length === 0) {
    return [];
  }
  const problems = flaggedRules(original, members);
  const numeric = numericProblems(problems, original.facts, ruleFacts);
  const freeOf = otherImprovements(problems, ruleFacts);
  const safeForAll = (context: ProductContext) =>
    members.every((m) => verdictFor(context, m).severity === "green");

  const closenessOf = input.closenessOf ?? (() => 0);
  const better = input.candidates.flatMap(({ item, context }) => {
    const meters = safeForAll(context) && metersFor(numeric, context.facts);
    if (!meters) return [];
    const score = meters.reduce((sum, m) => sum + m.drop, 0);
    return [{ item, meters, score, closeness: closenessOf(item) }];
  });

  return better
    .sort(closestThenBest)
    .slice(0, input.limit)
    .map(({ item, meters }) => ({
      item,
      improvements: [...meters.map(lessImprovement), ...freeOf],
    }));
}

/**
 * "Better, not perfect" (design 4a): when the original is Avoid for
 * someone, Caution candidates that are better on what flagged it. Never
 * Avoid for any of them, Caution for at least one (a Safe one belongs in
 * rankAlternatives), and lower on every number that flagged the original;
 * with no number to compare, free of at least one thing that flagged it.
 * Each carries what it's still flagged for, worst first.
 */
export function rankCautionAlternatives<T>(
  input: RankAlternativesInput<T>
): RankedCautionAlternative<T>[] {
  const { original, members, ruleFacts } = input;
  if (!members.some((m) => verdictFor(original, m).severity === "red")) {
    return [];
  }
  const problems = flaggedRules(original, members);
  const numeric = numericProblems(problems, original.facts, ruleFacts);
  const closenessOf = input.closenessOf ?? (() => 0);

  const better = input.candidates.flatMap(({ item, context }) => {
    if (!cautionAtWorst(context, members)) return [];
    const meters = metersFor(numeric, context.facts);
    if (meters === null || meters.some((meter) => meter.drop <= 0)) return [];
    // Free of something only where it was checked and passed: a rule the
    // candidate couldn't check (no ingredient list) is no "No peanuts".
    const remaining = remainingIssues(context, members);
    const freeOf = otherImprovements(
      without(problems, remaining.ruleIds),
      ruleFacts
    );
    const improvements = [...meters.map(lessImprovement), ...freeOf];
    if (improvements.length === 0) return [];
    const score = meters.reduce((sum, meter) => sum + meter.drop, 0);
    const ranked = {
      item,
      improvements,
      stillFlagged: remaining.labels,
    };
    return [{ ranked, score, closeness: closenessOf(item) }];
  });

  return better
    .sort(closestThenBest)
    .slice(0, input.limit)
    .map(({ ranked }) => ranked);
}

/** Like-for-like first (closeness), then the biggest improvement. */
function closestThenBest(a: RankKey, b: RankKey): number {
  return a.closeness - b.closeness || b.score - a.score;
}

/** Avoid for none of them, and Caution for at least one. */
function cautionAtWorst(
  context: ProductContext,
  members: AlternativeMember[]
): boolean {
  const severities = members.map((m) => verdictFor(context, m).severity);
  return !severities.includes("red") && severities.includes("yellow");
}

/** The original's flags a candidate has no issue with (flag or gap). */
function without(
  problems: Map<string, string>,
  candidateIssues: ReadonlySet<string>
): Map<string, string> {
  return new Map(
    [...problems].filter(([ruleId]) => !candidateIssues.has(ruleId))
  );
}

/**
 * Everything still wrong with a candidate for these members: the rules it
 * was flagged on or couldn't be checked on, and their chip labels with
 * flags first, worst first, then gaps.
 */
function remainingIssues(
  context: ProductContext,
  members: AlternativeMember[]
): RemainingIssues {
  const ruleIds = new Set<string>();
  const flags: Array<{ label: string; rank: number }> = [];
  const gaps: string[] = [];
  for (const member of members) {
    for (const reason of verdictFor(context, member).reasons) {
      ruleIds.add(reason.rule_id);
      if (reason.kind === "flag") {
        flags.push({
          label: reason.label,
          rank: SEVERITY_RANK[reason.severity],
        });
      } else {
        gaps.push(reason.label);
      }
    }
  }
  flags.sort((a, b) => b.rank - a.rank);
  const labels = [...flags.map((flag) => flag.label), ...gaps];
  return { ruleIds, labels: [...new Set(labels)] };
}

/** The candidate's value for each problem number; null if any is unknown. */
function metersFor(
  problems: NumericProblem[],
  facts: Record<string, unknown>
): Meter[] | null {
  const meters: Meter[] = [];
  for (const problem of problems) {
    const value = facts[problem.field];
    if (typeof value !== "number") {
      return null;
    }
    meters.push({
      ...problem,
      value,
      drop: (problem.original - value) / problem.original,
    });
  }
  return meters;
}

function lessImprovement(meter: Meter): Improvement {
  return {
    kind: "less",
    label: `${Math.round(meter.drop * 100)}% less ${factName(meter.field)}`,
    value: meter.value,
    original: meter.original,
    limit: meter.limit,
    unit: meter.unit,
  };
}

/** Every flag the original got for these members: rule id -> chip label. */
function flaggedRules(
  original: ProductContext,
  members: AlternativeMember[]
): Map<string, string> {
  const flagged = new Map<string, string>();
  for (const member of members) {
    for (const reason of verdictFor(original, member).reasons) {
      if (reason.kind === "flag") {
        flagged.set(reason.rule_id, reason.label);
      }
    }
  }
  return flagged;
}

/** Sugar/salt that flagged it: one entry per fact, at its strictest limit. */
function numericProblems(
  problems: Map<string, string>,
  facts: Record<string, unknown>,
  ruleFacts: RuleFacts
) {
  const byField = new Map<
    string,
    Omit<NumericProblem, "limit"> & { limit?: number }
  >();
  for (const ruleId of problems.keys()) {
    const rule = ruleFacts[ruleId];
    const original = rule && facts[rule.field];
    const unit = rule && meterUnit(rule.field);
    if (!rule || !unit || typeof original !== "number") {
      continue;
    }
    const current = byField.get(rule.field);
    const limits = [current?.limit, rule.threshold].filter(
      (limit): limit is number => limit !== undefined
    );
    byField.set(rule.field, {
      field: rule.field,
      unit,
      original,
      limit: limits.length ? Math.min(...limits) : undefined,
    });
  }
  // A meter needs a limit; sugar/salt rules always have a threshold.
  return [...byField.values()].filter(
    (problem): problem is NumericProblem =>
      problem.original > 0 && problem.limit !== undefined
  );
}

/** Chips for the non-numeric flags a Safe alternative is free of, in the
 *  original verdict's reason order. */
function otherImprovements(
  problems: Map<string, string>,
  ruleFacts: RuleFacts
): Improvement[] {
  const labels = new Set<string>();
  for (const [ruleId, label] of problems) {
    const field = ruleFacts[ruleId]?.field;
    if (field && meterUnit(field)) {
      continue;
    }
    const allergen = allergenCodeSchema.safeParse(
      ruleId.replace(/^allergen_/, "").replace(/_may_contain$/, "")
    );
    if (ruleId.startsWith("allergen_") && allergen.success) {
      labels.add(`No ${ALLERGEN_LABELS[allergen.data].toLowerCase()}`);
    } else if (field === "ingredient_category") {
      labels.add(`No ${label.toLowerCase()}`); // "No palm oil"
    } else if (field === "nova_group") {
      labels.add("Less processed");
    } else if (field === "additive_count") {
      labels.add("Fewer additives");
    }
  }
  return [...labels].map((label) => ({ kind: "free_of", label }));
}
