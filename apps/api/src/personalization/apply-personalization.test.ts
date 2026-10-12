import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPersonalization } from "./apply-personalization";

describe("applyPersonalization", () => {
  it("escalates yellow to red for a diabetic when sugar exceeds the trigger", () => {
    const result = applyPersonalization({
      base: {
        severity: "yellow",
        breakdown: [
          {
            rule_id: "nova4",
            field: "nova_group",
            matched_value: 4,
            severity: "yellow",
            reason: "Ultra-processed",
          },
        ],
        unevaluated: [],
      },
      facts: { sugar_per_100g: 18 },
      memberConditions: ["diabetic"],
      rules: [
        {
          id: "diabetic_sugar_escalation",
          condition: "diabetic",
          field: "sugar_per_100g",
          operator: ">",
          threshold: 15,
          effect: "escalate one level",
          message: "Escalated: high sugar flagged for diabetic profile",
          label: "Too sweet for diabetes",
        },
      ],
    });
    assert.equal(result.severity, "red");
    // Only the member's own flags; the base flag stays in base.breakdown.
    assert.deepEqual(result.flags, [
      {
        kind: "flag",
        severity: "red",
        label: "Too sweet for diabetes",
        text: "Escalated: high sugar flagged for diabetic profile",
        rule_id: "diabetic_sugar_escalation",
      },
    ]);
  });

  it("does not apply when the member lacks the condition", () => {
    const result = applyPersonalization({
      base: { severity: "green", breakdown: [], unevaluated: [] },
      facts: { sugar_per_100g: 18 },
      memberConditions: [],
      rules: [
        {
          id: "diabetic_sugar_escalation",
          condition: "diabetic",
          field: "sugar_per_100g",
          operator: ">",
          threshold: 15,
          effect: "escalate one level",
          message: "Escalated: high sugar flagged for diabetic profile",
        },
      ],
    });
    assert.equal(result.severity, "green");
    assert.deepEqual(result.flags, []);
  });

  it("explains every escalation, even when the rule's message is blank", () => {
    const result = applyPersonalization({
      base: { severity: "yellow", breakdown: [], unevaluated: [] },
      facts: { sugar_per_100g: 18 },
      memberConditions: ["diabetic"],
      rules: [
        {
          id: "diabetic_sugar_escalation",
          condition: "diabetic",
          field: "sugar_per_100g",
          operator: ">",
          threshold: 15,
          effect: "escalate one level",
          message: "",
        },
      ],
    });
    assert.equal(result.severity, "red");
    assert.deepEqual(
      result.flags.map((f) => [f.rule_id, f.severity, f.label]),
      [["diabetic_sugar_escalation", "red", "Flagged"]]
    );
  });

  it("is never Safe for them when their condition couldn't be checked", () => {
    // No sugar value at all: we can't tell whether it's fine for diabetes.
    const result = applyPersonalization({
      base: { severity: "green", breakdown: [], unevaluated: [] },
      facts: {},
      memberConditions: ["diabetic"],
      rules: [
        {
          id: "diabetic_sugar_escalation",
          condition: "diabetic",
          field: "sugar_per_100g",
          operator: ">",
          threshold: 15,
          effect: "escalate one level",
          message: "High sugar",
        },
      ],
    });
    assert.equal(result.severity, "yellow");
    assert.equal(result.unchecked[0].text, "Couldn't check sugar for diabetes");
  });

  describe("solid vs drink rules", () => {
    const rules = [
      {
        id: "diabetic_sugar_escalation",
        condition: "diabetic" as const,
        field: "sugar_per_100g",
        operator: ">" as const,
        threshold: 15,
        effect: "escalate one level" as const,
        message: "High sugar",
        applies_to: "solid" as const,
      },
      {
        id: "diabetic_sugar_escalation_liquid",
        condition: "diabetic" as const,
        field: "sugar_per_100ml",
        operator: ">" as const,
        threshold: 7.5,
        effect: "escalate one level" as const,
        message: "High sugar",
        applies_to: "liquid" as const,
      },
    ];
    const base = {
      severity: "yellow" as const,
      breakdown: [],
      unevaluated: [],
    };

    it("escalates a sugary drink with the drink rule, without a per-100g gap", () => {
      const result = applyPersonalization({
        base,
        facts: { product_form: "liquid", sugar_per_100ml: 10.6 },
        memberConditions: ["diabetic"],
        rules,
      });
      assert.equal(result.severity, "red");
      assert.deepEqual(
        result.flags.map((f) => f.rule_id),
        ["diabetic_sugar_escalation_liquid"]
      );
      assert.deepEqual(result.unchecked, []);
    });

    it("uses only the solid rule on a solid", () => {
      const result = applyPersonalization({
        base,
        facts: { product_form: "solid", sugar_per_100g: 20 },
        memberConditions: ["diabetic"],
        rules,
      });
      assert.deepEqual(
        result.flags.map((f) => f.rule_id),
        ["diabetic_sugar_escalation"]
      );
      assert.deepEqual(result.unchecked, []);
    });
  });
});
