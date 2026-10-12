import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenCode, HealthConditionCode } from "@foodscanner/shared";
import { allergenEvidence } from "../allergens/allergen-evidence";
import { evaluateRules, passedRules } from "../scoring/evaluate-rules";
import { HLD_EXAMPLE_RULES } from "../scoring/hld-example-rules";
import { HLD_PERSONALIZATION_SEEDS } from "../workers/seed/hld-seed";
import { verdictFor, type ProductContext } from "./household-verdict";

// The real dev seed rules, end to end through verdictFor.
const context = (
  facts: Record<string, unknown>,
  ingredients: string[] = ["Wheat flour", "Sugar"]
): ProductContext => {
  const withForm = { product_form: "solid", ...facts };
  const base = evaluateRules(withForm, HLD_EXAMPLE_RULES);
  return {
    base,
    facts: withForm,
    ruleLabels: Object.fromEntries(
      HLD_EXAMPLE_RULES.map((rule) => [rule.id, rule.label ?? ""])
    ),
    basePassed: passedRules(HLD_EXAMPLE_RULES, base, {
      productForm: withForm.product_form,
      allIngredientsRecognised: true,
    }),
    rules: HLD_PERSONALIZATION_SEEDS,
    allergens: allergenEvidence({ ingredients, declared: null }),
  };
};
const checkedFor = (
  facts: Record<string, unknown>,
  conditions: HealthConditionCode[] = [],
  allergies: AllergenCode[] = [],
  ingredients?: string[]
) => verdictFor(context(facts, ingredients), { conditions, allergies }).checked;

const everything = {
  sugar_per_100g: 3,
  sodium_per_100g: 50,
  ingredient_category: [],
  additive_count: 0,
  nova_group: 1,
};

describe("what we checked", () => {
  it("lists each topic once, with what it was also checked for", () => {
    assert.deepEqual(checkedFor(everything, ["diabetic"], ["peanuts"]), [
      { label: "Sugar", for: ["diabetes"] },
      { label: "Salt", for: [] },
      { label: "Palm oil", for: [] },
      { label: "Additives", for: [] },
      { label: "Processing", for: [] },
      { label: "Peanuts", for: ["allergy"] },
    ]);
  });

  it("never ticks a topic that was flagged", () => {
    // 10 g sugar passes the UK 22.5 g rule but fails FSSAI's 5 g limit.
    const checked = checkedFor({ ...everything, sugar_per_100g: 10 }, [
      "diabetic",
    ]);
    assert.equal(
      checked.some((check) => check.label === "Sugar"),
      false
    );
  });

  it("never ticks what it couldn't check", () => {
    const { sugar_per_100g: _unknown, ...noSugar } = everything;
    const checked = checkedFor(noSugar, ["diabetic"]);
    assert.equal(
      checked.some((check) => check.label === "Sugar"),
      false
    );
  });

  it("doesn't tick palm oil when some ingredients weren't recognised", () => {
    const facts = { product_form: "solid", ...everything };
    const base = evaluateRules(facts, HLD_EXAMPLE_RULES);
    const passed = passedRules(HLD_EXAMPLE_RULES, base, {
      productForm: "solid",
      allIngredientsRecognised: false,
    });
    assert.equal(
      passed.some((rule) => rule.rule_id === "palm_oil"),
      false
    );
    assert.ok(
      passed.some((rule) => rule.rule_id === "fssai_cannot_claim_low_sugar")
    );
  });

  it("doesn't tick an allergen without an ingredient list", () => {
    const checked = checkedFor(everything, [], ["milk"], []);
    assert.equal(
      checked.some((check) => check.label === "Milk"),
      false
    );
  });
});
