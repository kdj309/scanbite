import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MISSING_ACTIVE_RULE_SET,
  requireActiveRuleSet,
} from "./active-rule-set";
import { confidenceForVersion, confidenceFromUnresolved } from "./facts";

describe("requireActiveRuleSet", () => {
  it("throws instead of treating a missing rule set as green", () => {
    assert.throws(() => requireActiveRuleSet(null), {
      name: "Error",
      message: MISSING_ACTIVE_RULE_SET,
    });
    assert.equal(requireActiveRuleSet({ version: "1" }).version, "1");
  });
});

describe("confidenceForVersion", () => {
  it("is full when every ingredient is resolved", () => {
    assert.equal(confidenceFromUnresolved(0, 4), "full");
    const result = confidenceForVersion({
      ingredients: [{ raw: "Sugar", canonical_id: null, status: "resolved" }],
    });
    assert.equal(result.confidence, "full");
    assert.deepEqual(result.unresolved_ingredients, []);
  });

  it("is partial below half unresolved and low at half or more", () => {
    assert.equal(confidenceFromUnresolved(1, 3), "partial");
    assert.equal(confidenceFromUnresolved(1, 2), "low");
    assert.equal(confidenceFromUnresolved(1, 0), "low");
    const result = confidenceForVersion({
      ingredients: [
        { raw: "Wheat Flour", canonical_id: null, status: "resolved" },
        { raw: "Refined Bran Oil", canonical_id: null, status: "unresolved" },
      ],
    });
    assert.equal(result.confidence, "low");
    assert.deepEqual(result.unresolved_ingredients, ["Refined Bran Oil"]);
  });
});
