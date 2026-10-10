import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvaluationResult } from "../scoring/evaluate-rules";
import type { PersonalizationRuleInput } from "./apply-personalization";
import { householdVerdict } from "./household-verdict";

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

const verdictFor = (
  members: { id: string; name: string; conditions: string[] }[]
) => householdVerdict({ base, facts, ruleLabels: {}, members, rules });

describe("householdVerdict", () => {
  it("opens on the most affected member with conditions", () => {
    const result = verdictFor([
      { id: "you", name: "You", conditions: [] },
      { id: "amma", name: "Amma", conditions: ["hypertensive"] },
      { id: "papa", name: "Papa", conditions: ["diabetic"] },
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
      { id: "amma", name: "Amma", conditions: ["hypertensive"] },
      { id: "papa", name: "Papa", conditions: ["gout"] },
    ]);
    assert.deepEqual(result.overall, { severity: "yellow", member_id: "amma" });
  });

  it("never lets a member without conditions drive the overall verdict", () => {
    const result = verdictFor([
      { id: "you", name: "You", conditions: [] },
      { id: "amma", name: "Amma", conditions: ["hypertensive"] },
    ]);
    assert.equal(result.overall.member_id, "amma");
    assert.equal(result.members[0].has_conditions, false);
  });

  it("falls back to the general verdict when nobody has conditions", () => {
    const result = verdictFor([{ id: "you", name: "You", conditions: [] }]);
    assert.deepEqual(result.overall, { severity: "yellow", member_id: null });
    assert.equal(result.members[0].verdict.severity, "yellow");
  });
});
