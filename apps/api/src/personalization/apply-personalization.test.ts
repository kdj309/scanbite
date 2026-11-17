import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HLD_PERSONALIZATION_SEEDS } from "../workers/seed/hld-seed";
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
        field: "sugar_per_100g",
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

  describe("salt rules for BP, heart and kidney disease (seeded)", () => {
    const rules = HLD_PERSONALIZATION_SEEDS;
    const yellow = {
      severity: "yellow" as const,
      breakdown: [],
      unevaluated: [],
    };
    const green = {
      severity: "green" as const,
      breakdown: [],
      unevaluated: [],
    };

    it("escalates a very salty snack to Avoid for BP (Ompudi, 1415 mg/100 g)", () => {
      const result = applyPersonalization({
        base: yellow,
        facts: { product_form: "solid", sodium_per_100g: 1415.2 },
        memberConditions: ["hypertensive"],
        rules,
      });
      assert.equal(result.severity, "red");
      assert.deepEqual(
        result.flags.map((f) => [f.rule_id, f.label]),
        [["hypertensive_sodium_escalation", "Too salty for BP"]]
      );
      assert.deepEqual(result.flaggedTopics, ["Salt"]);
      assert.deepEqual(result.checked, []);
    });

    it("leaves salt at or under the ICMR level alone, and says it checked", () => {
      const result = applyPersonalization({
        base: green,
        facts: { product_form: "solid", sodium_per_100g: 250 },
        memberConditions: ["hypertensive", "chronic_kidney_disease"],
        rules,
      });
      assert.equal(result.severity, "green");
      assert.deepEqual(result.flags, []);
      assert.deepEqual(result.checked, [
        { topic: "Salt", for: "hypertension" },
        { topic: "Salt", for: "chronic kidney disease" },
      ]);
    });

    it("uses the 70 mg/100 ml level for drinks", () => {
      const result = applyPersonalization({
        base: green,
        facts: { product_form: "liquid", sodium_per_100ml: 80 },
        memberConditions: ["cardiovascular"],
        rules,
      });
      assert.equal(result.severity, "yellow");
      assert.deepEqual(
        result.flags.map((f) => f.rule_id),
        ["cardiovascular_sodium_escalation_liquid"]
      );
    });

    it("gives someone with BP and heart disease one salt flag, not two", () => {
      const result = applyPersonalization({
        base: yellow,
        facts: { product_form: "solid", sodium_per_100g: 600 },
        memberConditions: ["cardiovascular", "hypertensive"],
        rules,
      });
      assert.equal(result.severity, "red");
      assert.deepEqual(
        result.flags.map((f) => f.rule_id),
        ["hypertensive_sodium_escalation"]
      );
    });

    it("is never Safe when salt is missing, with one gap naming every condition", () => {
      const result = applyPersonalization({
        base: green,
        facts: { product_form: "solid", sugar_per_100g: 1 },
        memberConditions: [
          "cardiovascular",
          "hypertensive",
          "chronic_kidney_disease",
        ],
        rules,
      });
      assert.equal(result.severity, "yellow");
      assert.deepEqual(
        result.unchecked.map((u) => [u.label, u.text, u.rule_id]),
        [
          [
            "Salt not checked",
            "Couldn't check salt for hypertension, heart disease and chronic kidney disease",
            "hypertensive_sodium_escalation",
          ],
        ]
      );
    });

    it("doesn't touch members without these conditions", () => {
      const result = applyPersonalization({
        base: yellow,
        facts: { product_form: "solid", sodium_per_100g: 1415 },
        memberConditions: ["dyslipidemia"],
        rules,
      });
      assert.equal(result.severity, "yellow");
      assert.deepEqual(result.flags, []);
      assert.deepEqual(result.unchecked, []);
    });
  });
});
