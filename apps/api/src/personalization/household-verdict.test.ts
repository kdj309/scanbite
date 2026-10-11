import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenCode, HealthConditionCode } from "@foodscanner/shared";
import type { AllergenEvidence } from "../allergens/allergen-evidence";
import type { EvaluationResult } from "../scoring/evaluate-rules";
import type { PersonalizationRuleInput } from "./apply-personalization";
import {
  householdVerdict,
  type HouseholdMemberInput,
} from "./household-verdict";

// A yellow product (FSSAI low-sugar flag) with 18 g sugar/100 g.
const base: EvaluationResult = {
  severity: "yellow",
  breakdown: [
    {
      rule_id: "fssai_cannot_claim_low_sugar",
      field: "sugar_per_100g",
      matched_value: 18,
      severity: "yellow",
      reason: "Exceeds FSSAI low sugars threshold",
    },
  ],
  unevaluated: [],
};
const facts = { product_form: "solid", sugar_per_100g: 18 };
const rules: PersonalizationRuleInput[] = [
  {
    id: "diabetic_sugar_escalation",
    condition: "diabetic",
    field: "sugar_per_100g",
    operator: ">",
    threshold: 15,
    effect: "escalate one level",
    message: "High sugar — caution advised for diabetics",
    label: "Too sweet for diabetes",
  },
];

const noAllergens: AllergenEvidence = { findings: {}, hasIngredientList: true };

const verdictFor = (
  members: HouseholdMemberInput[],
  allergens: AllergenEvidence = noAllergens
) =>
  householdVerdict(
    { base, facts, ruleLabels: {}, basePassed: [], rules, allergens },
    members
  );

const member = (
  id: string,
  conditions: HealthConditionCode[] = [],
  allergies: AllergenCode[] = []
): HouseholdMemberInput => ({ id, name: id, conditions, allergies });

describe("householdVerdict", () => {
  it("opens on the most affected member with a health profile", () => {
    const result = verdictFor([
      member("you"),
      member("amma", ["hypertensive"]),
      member("papa", ["diabetic"]),
    ]);
    assert.deepEqual(result.overall, { severity: "red", member_id: "papa" });
    assert.deepEqual(
      result.members.map((m) => [m.member_id, m.verdict.severity]),
      [
        ["you", "yellow"],
        ["amma", "yellow"],
        ["papa", "red"],
      ]
    );
    assert.equal(
      result.members[2].verdict.reasons[0].rule_id,
      "diabetic_sugar_escalation"
    );
  });

  it("takes the first member in household order on a tie", () => {
    const result = verdictFor([
      member("amma", ["hypertensive"]),
      member("papa", ["gout"]),
    ]);
    assert.deepEqual(result.overall, { severity: "yellow", member_id: "amma" });
  });

  it("never lets a member without conditions or allergies drive the overall verdict", () => {
    const result = verdictFor([
      member("you"),
      member("amma", ["hypertensive"]),
    ]);
    assert.equal(result.overall.member_id, "amma");
    assert.equal(result.members[0].has_health_profile, false);
  });

  it("lets an allergy alone drive the overall verdict", () => {
    // Not "Safe for everyone" when it contains peanuts for Amma.
    const result = verdictFor(
      [member("papa", ["gout"]), member("amma", [], ["peanuts"])],
      {
        findings: {
          peanuts: { presence: "contains", ingredient: "groundnut oil" },
        },
        hasIngredientList: true,
      }
    );
    assert.deepEqual(result.overall, { severity: "red", member_id: "amma" });
    assert.equal(result.members[1].has_health_profile, true);
    assert.equal(
      result.members[1].verdict.reasons[0].rule_id,
      "allergen_peanuts"
    );
  });

  it("falls back to the general verdict when nobody has a health profile", () => {
    const result = verdictFor([member("you")]);
    assert.deepEqual(result.overall, { severity: "yellow", member_id: null });
    assert.equal(result.members[0].verdict.severity, "yellow");
  });
});
