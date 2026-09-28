import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEALTH_CONDITION_CODES,
  HEALTH_CONDITION_LABELS,
  createHouseholdMemberRequestSchema,
  healthConditionCodeSchema,
  healthConditionListSchema,
} from "@foodscanner/shared";

describe("health condition codes", () => {
  it("accepts the ten canonical codes and rejects synonyms", () => {
    assert.equal(HEALTH_CONDITION_CODES.length, 10);
    assert.equal(healthConditionCodeSchema.parse("diabetic"), "diabetic");
    assert.equal(healthConditionCodeSchema.parse("obesity"), "obesity");
    assert.equal(
      healthConditionCodeSchema.parse("cardiovascular"),
      "cardiovascular"
    );
    assert.equal(
      healthConditionCodeSchema.safeParse("diabetes").success,
      false
    );
    assert.equal(
      healthConditionCodeSchema.safeParse("Diabetic").success,
      false
    );
    assert.equal(
      healthConditionCodeSchema.safeParse("heart disease").success,
      false
    );
  });

  it("exposes a UI label for every code", () => {
    assert.equal(HEALTH_CONDITION_LABELS.cardiovascular, "Heart disease");
    assert.equal(HEALTH_CONDITION_LABELS.obesity, "Obesity");
    for (const code of HEALTH_CONDITION_CODES) {
      assert.equal(typeof HEALTH_CONDITION_LABELS[code], "string");
      assert.ok(HEALTH_CONDITION_LABELS[code].length > 0);
    }
  });

  it("rejects unknown or duplicate conditions on household create", () => {
    const base = { name: "Ada", relationship: "self" as const };
    assert.equal(
      createHouseholdMemberRequestSchema.safeParse({
        ...base,
        conditions: ["diabetic", "obesity"],
      }).success,
      true
    );
    assert.equal(
      createHouseholdMemberRequestSchema.safeParse({
        ...base,
        conditions: ["diabetes"],
      }).success,
      false
    );
    assert.equal(
      healthConditionListSchema.safeParse(["diabetic", "diabetic"]).success,
      false
    );
  });
});
