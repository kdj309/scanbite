import {
  ALLERGEN_LABELS,
  allergenCodeSchema,
  type Improvement,
} from "@foodscanner/shared";
import {
  verdictFor,
  type HouseholdMemberInput,
  type ProductContext,
} from "../personalization/household-verdict";
import { NUTRITION_FACTS, factName } from "../personalization/member-overlay";

/** Facts with a number we can compare and meter (sugar, salt). */
function meterUnit(field: string): "g" | "mg" | undefined {
  return NUTRITION_FACTS[field]?.unit;
}

type Member = Pick<HouseholdMemberInput, "conditions" | "allergies">;

/** What each scoring/condition rule checks, from the rule definitions. */
export type RuleFacts = Record<string, { field: string; threshold?: number }>;

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
export function rankAlternatives<T>(input: {
  original: ProductContext;
  candidates: Array<{ item: T; context: ProductContext }>;
  members: Member[];
  ruleFacts: RuleFacts;
  limit: number;
}): RankedAlternative<T>[] {
  const { original, members, ruleFacts } = input;
  if (members.length === 0) {
    return [];
  }
  const problems = flaggedRules(original, members);
  const numeric = numericProblems(problems, original.facts, ruleFacts);
  const freeOf = otherImprovements(problems, ruleFacts);
  const safeForAll = (context: ProductContext) =>
    members.every((m) => verdictFor(context, m).severity === "green");

  const better = input.candidates.flatMap(({ item, context }) => {
    const meters = safeForAll(context) && metersFor(numeric, context.facts);
    return meters
      ? [{ item, meters, score: meters.reduce((sum, m) => sum + m.drop, 0) }]
      : [];
  });

  return better
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit)
    .map(({ item, meters }) => ({
      item,
      improvements: [...meters.map(lessImprovement), ...freeOf],
    }));
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
  members: Member[]
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
