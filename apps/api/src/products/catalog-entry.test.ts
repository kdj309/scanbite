import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenCode, HealthConditionCode } from "@foodscanner/shared";
import { allergenEvidence } from "../allergens/allergen-evidence";
import type {
  HouseholdMemberInput,
  ProductContext,
} from "../personalization/household-verdict";
import { evaluateRules, passedRules } from "../scoring/evaluate-rules";
import { HLD_EXAMPLE_RULES } from "../scoring/hld-example-rules";
import { HLD_PERSONALIZATION_SEEDS } from "../workers/seed/hld-seed";
import { catalogEntry } from "./catalog-entry";

const context = (facts: Record<string, unknown>): ProductContext => {
  const withForm = { product_form: "solid", ...facts };
  const base = evaluateRules(withForm, HLD_EXAMPLE_RULES);
  return {
    base,
    facts: withForm,
    ruleLabels: Object.fromEntries(
      HLD_EXAMPLE_RULES.map((rule) => [rule.id, rule.label ?? ""])
    ),
    basePassed: passedRules(HLD_EXAMPLE_RULES, base, {
      productForm: "solid",
      allIngredientsRecognised: true,
    }),
    rules: HLD_PERSONALIZATION_SEEDS,
    allergens: allergenEvidence({ ingredients: ["Wheat"], declared: null }),
  };
};
const member = (
  id: string,
  conditions: HealthConditionCode[],
  allergies: AllergenCode[] = []
): HouseholdMemberInput => ({ id, name: id, conditions, allergies });

describe("catalogEntry", () => {
  it("rings every member and puts the worst one's main reason on the chip", () => {
    const entry = catalogEntry(context({ sugar_per_100g: 18 }), [
      member("amma", ["hypertensive"]),
      member("papa", ["diabetic"]),
    ]);
    assert.deepEqual(entry.overall, { severity: "red", member_id: "papa" });
    assert.deepEqual(entry.members, [
      { member_id: "amma", severity: "yellow" },
      { member_id: "papa", severity: "red" },
    ]);
    assert.deepEqual(entry.main_reason, {
      kind: "flag",
      label: "Too sweet for diabetes",
      rule_id: "diabetic_sugar_escalation",
    });
  });

  it("has no chip when it's Safe for everyone included", () => {
    const entry = catalogEntry(
      context({
        sugar_per_100g: 1,
        sodium_per_100g: 10,
        additive_count: 0,
        nova_group: 1,
        ingredient_category: [],
      }),
      [member("papa", ["diabetic"])]
    );
    assert.equal(entry.overall.severity, "green");
    assert.equal(entry.main_reason, null);
  });

  it("uses the general verdict when nobody is included", () => {
    const entry = catalogEntry(context({ sugar_per_100g: 30 }), []);
    assert.deepEqual(entry.overall, { severity: "red", member_id: null });
    assert.deepEqual(entry.members, []);
    assert.equal(entry.main_reason?.label, "Very high sugar");
  });

  it("explains a Caution that comes from something we couldn't check", () => {
    // No sugar value: Caution for a diabetic, and the chip says why.
    const entry = catalogEntry(context({}), [member("papa", ["diabetic"])]);
    assert.equal(entry.overall.severity, "yellow");
    assert.deepEqual(entry.main_reason, {
      kind: "unchecked",
      label: "Sugar not checked",
      rule_id: "diabetic_sugar_escalation",
    });
  });
});
