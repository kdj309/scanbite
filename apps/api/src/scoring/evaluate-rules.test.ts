import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRules } from "./evaluate-rules";
import { HLD_EXAMPLE_RULES } from "./hld-example-rules";

describe("evaluateRules (HLD §6b)", () => {
  it("defaults to green when no rules match", () => {
    const result = evaluateRules(
      { sugar_per_100g: 5, additive_count: 0, nova_group: 1 },
      HLD_EXAMPLE_RULES,
    );
    assert.equal(result.severity, "green");
    assert.equal(result.breakdown.length, 0);
  });

  it("uses worst-flag-wins so high sugar is red even with NOVA 4", () => {
    const result = evaluateRules(
      {
        sugar_per_100g: 24,
        ingredient_category: ["palm_oil"],
        additive_count: 4,
        nova_group: 4,
      },
      HLD_EXAMPLE_RULES,
    );
    assert.equal(result.severity, "red");
    assert.equal(result.breakdown.length, 4);
    assert.ok(result.breakdown.some((item) => item.rule_id === "sugar_who"));
  });

  it("keeps NOVA 4 as yellow on its own", () => {
    const result = evaluateRules({ nova_group: 4 }, HLD_EXAMPLE_RULES);
    assert.equal(result.severity, "yellow");
    assert.deepEqual(
      result.breakdown.map((item) => item.rule_id),
      ["nova4"],
    );
  });
});
