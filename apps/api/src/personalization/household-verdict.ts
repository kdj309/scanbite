import type {
  HealthConditionCode,
  MemberVerdict,
  ProductFoundResponse,
} from "@foodscanner/shared";
import {
  SEVERITY_RANK,
  type EvaluationResult,
} from "../scoring/evaluate-rules";
import {
  applyPersonalization,
  type PersonalizationRuleInput,
} from "./apply-personalization";
import { buildVerdictReasons } from "./verdict-reasons";

export type HouseholdMemberInput = {
  id: string;
  name: string;
  conditions: HealthConditionCode[];
};

/**
 * Every member's verdict for one product, plus the overall one: the worst
 * among members WITH conditions (first in household order on a tie) and
 * whose it is. Members without conditions get the general verdict and
 * never count toward the overall — "Safe" must not mean "nobody checked".
 */
export function householdVerdict(input: {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  ruleLabels: Record<string, string>;
  members: HouseholdMemberInput[];
  rules: PersonalizationRuleInput[];
}): Pick<ProductFoundResponse, "overall" | "members"> {
  const { base, facts, ruleLabels, rules } = input;

  const members: MemberVerdict[] = input.members.map((member) => {
    const personalized = applyPersonalization({
      base,
      facts,
      memberConditions: member.conditions,
      rules,
    });
    return {
      member_id: member.id,
      name: member.name,
      has_conditions: member.conditions.length > 0,
      verdict: {
        severity: personalized.severity,
        reasons: buildVerdictReasons({ base, personalized, ruleLabels }),
      },
    };
  });

  let driver: MemberVerdict | null = null;
  for (const member of members) {
    if (
      member.has_conditions &&
      (!driver ||
        SEVERITY_RANK[member.verdict.severity] >
          SEVERITY_RANK[driver.verdict.severity])
    ) {
      driver = member;
    }
  }

  return {
    overall: driver
      ? { severity: driver.verdict.severity, member_id: driver.member_id }
      : { severity: base.severity, member_id: null },
    members,
  };
}
