import type {
  AllergenCode,
  HealthConditionCode,
  MemberVerdict,
  ProductFoundResponse,
  Verdict,
} from "@foodscanner/shared";
import type { AllergenEvidence } from "../allergens/allergen-evidence";
import { applyAllergies } from "../allergens/apply-allergies";
import {
  SEVERITY_RANK,
  type EvaluationResult,
  type PassedRule,
} from "../scoring/evaluate-rules";
import {
  applyPersonalization,
  type PersonalizationRuleInput,
} from "./apply-personalization";
import { combineOverlays } from "./member-overlay";
import { buildVerdictReasons } from "./verdict-reasons";
import { whatWeChecked } from "./what-we-checked";

export type HouseholdMemberInput = {
  id: string;
  name: string;
  conditions: HealthConditionCode[];
  allergies: AllergenCode[];
};

/** Everything about one product that a member's verdict depends on. */
export type ProductContext = {
  base: EvaluationResult;
  facts: Record<string, unknown>;
  ruleLabels: Record<string, string>;
  /** General rules that applied and passed. */
  basePassed: PassedRule[];
  rules: PersonalizationRuleInput[];
  allergens: AllergenEvidence;
};

/** One member's verdict: general rules + their conditions + allergies. */
export function verdictFor(
  product: ProductContext,
  member: Pick<HouseholdMemberInput, "conditions" | "allergies">
): Verdict {
  const overlay = combineOverlays(
    applyPersonalization({
      base: product.base,
      facts: product.facts,
      memberConditions: member.conditions,
      rules: product.rules,
    }),
    applyAllergies(member.allergies, product.allergens)
  );
  return {
    severity: overlay.severity,
    reasons: buildVerdictReasons({
      base: product.base,
      overlay,
      ruleLabels: product.ruleLabels,
    }),
    checked: whatWeChecked({
      basePassed: product.basePassed,
      base: product.base,
      ruleLabels: product.ruleLabels,
      overlay,
    }),
  };
}

/** Someone with no conditions or allergies: their verdict is the general one. */
export const GENERAL_MEMBER: Pick<
  HouseholdMemberInput,
  "conditions" | "allergies"
> = { conditions: [], allergies: [] };

export function hasHealthProfile(
  member: Pick<HouseholdMemberInput, "conditions" | "allergies">
): boolean {
  return member.conditions.length > 0 || member.allergies.length > 0;
}

/**
 * Every member's verdict for one product, plus the overall one: the worst
 * among members with a health profile (first in household order on a tie)
 * and whose it is. Members with neither conditions nor allergies get the
 * general verdict and never count toward the overall — "Safe" must not
 * mean "nobody checked".
 */
export function householdVerdict(
  product: ProductContext,
  members: HouseholdMemberInput[]
): Pick<ProductFoundResponse, "overall" | "members"> {
  const verdicts: MemberVerdict[] = members.map((member) => ({
    member_id: member.id,
    name: member.name,
    has_health_profile: hasHealthProfile(member),
    verdict: verdictFor(product, member),
  }));

  let driver: MemberVerdict | null = null;
  for (const member of verdicts) {
    if (
      member.has_health_profile &&
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
      : { severity: product.base.severity, member_id: null },
    members: verdicts,
  };
}
