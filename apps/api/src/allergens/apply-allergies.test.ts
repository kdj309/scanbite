import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenEvidence } from "./allergen-evidence";
import { applyAllergies } from "./apply-allergies";

const evidence = (
  findings: AllergenEvidence["findings"],
  hasIngredientList = true
): AllergenEvidence => ({ findings, hasIngredientList });

describe("applyAllergies", () => {
  it("is Avoid when the product contains one of the member's allergens", () => {
    const result = applyAllergies(
      ["peanuts"],
      evidence({
        peanuts: { presence: "contains", ingredient: "Groundnut Oil" },
      })
    );
    assert.equal(result.severity, "red");
    assert.deepEqual(result.flags, [
      {
        kind: "flag",
        severity: "red",
        label: "Contains peanuts",
        text: 'Contains peanuts — in the ingredients: "Groundnut Oil"',
        rule_id: "allergen_peanuts",
      },
    ]);
  });

  it("is Avoid for 'may contain' too (strict)", () => {
    const result = applyAllergies(
      ["tree_nuts"],
      evidence({ tree_nuts: { presence: "may_contain", ingredient: null } })
    );
    assert.equal(result.severity, "red");
    assert.equal(result.flags[0].label, "May contain tree nuts");
    assert.equal(result.flags[0].rule_id, "allergen_tree_nuts_may_contain");
  });

  it("ignores allergens the member doesn't have", () => {
    const result = applyAllergies(
      ["sesame"],
      evidence({ milk: { presence: "contains", ingredient: "Milk" } })
    );
    assert.deepEqual(result, {
      severity: "green",
      flags: [],
      unchecked: [],
      // Their sesame allergy was checked against the ingredients, and passed.
      checked: [{ topic: "Sesame", for: "allergy" }],
      flaggedTopics: [],
    });
  });

  it("is never Safe when there was no ingredient list to check", () => {
    const result = applyAllergies(["milk"], evidence({}, false));
    assert.equal(result.severity, "yellow");
    assert.deepEqual(
      result.unchecked.map((reason) => [reason.label, reason.text]),
      [["Milk not checked", "Couldn't check for milk — no ingredient list"]]
    );
  });
});
