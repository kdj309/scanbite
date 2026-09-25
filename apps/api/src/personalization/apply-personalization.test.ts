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
      },
      facts: { sugar_per_100g: 18 },
      memberConditions: ["diabetic"],
      rules: [
        {
          condition: "diabetic",
          trigger: "sugar_per_100g > 15",
          effect: "escalate one level",
          message: "Escalated: high sugar flagged for diabetic profile",
        },
      ],
    });
    assert.equal(result.severity, "red");
    assert.deepEqual(result.reasons, [
      "Ultra-processed",
      "Escalated: high sugar flagged for diabetic profile",
    ]);
  });

  it("does not apply when the member lacks the condition", () => {
    const result = applyPersonalization({
      base: { severity: "green", breakdown: [] },
      facts: { sugar_per_100g: 18 },
      memberConditions: [],
      rules: [
        {
          condition: "diabetic",
          trigger: "sugar_per_100g > 15",
          effect: "escalate one level",
          message: "Escalated: high sugar flagged for diabetic profile",
        },
      ],
    });
    assert.equal(result.severity, "green");
    assert.deepEqual(result.reasons, []);
  });
});
