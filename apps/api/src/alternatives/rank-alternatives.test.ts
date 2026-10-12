import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenCode, HealthConditionCode } from "@foodscanner/shared";
import { allergenEvidence } from "../allergens/allergen-evidence";
import type { ProductContext } from "../personalization/household-verdict";
import { evaluateRules, passedRules } from "../scoring/evaluate-rules";
import { HLD_EXAMPLE_RULES } from "../scoring/hld-example-rules";
import { HLD_PERSONALIZATION_SEEDS } from "../workers/seed/hld-seed";
import { rankAlternatives, type RuleFacts } from "./rank-alternatives";

// The real dev seed rules: FSSAI/UK sugar + salt, palm oil, additives,
// NOVA, and the diabetic sugar escalation.
const ruleLabels = Object.fromEntries(
  HLD_EXAMPLE_RULES.map((rule) => [rule.id, rule.label ?? ""])
);
const ruleFacts: RuleFacts = Object.fromEntries(
  [...HLD_EXAMPLE_RULES, ...HLD_PERSONALIZATION_SEEDS].map((rule) => [
    rule.id,
    { field: rule.field, threshold: rule.threshold },
  ])
);

const context = (
  facts: Record<string, unknown>,
  ingredients: string[] = ["Something"]
): ProductContext => {
  const withForm = { product_form: "solid", ...facts };
  const base = evaluateRules(withForm, HLD_EXAMPLE_RULES);
  return {
    base,
    facts: withForm,
    ruleLabels,
    basePassed: passedRules(HLD_EXAMPLE_RULES, base, {
      productForm: withForm.product_form,
      allIngredientsRecognised: true,
    }),
    rules: HLD_PERSONALIZATION_SEEDS,
    allergens: allergenEvidence({ ingredients, declared: null }),
  };
};
const candidate = (
  name: string,
  facts: Record<string, unknown>,
  ingredients?: string[]
) => ({
  item: name,
  context: context(facts, ingredients),
});
const member = (
  conditions: HealthConditionCode[],
  allergies: AllergenCode[] = []
) => ({ conditions, allergies });
const papa = member(["diabetic"]);

describe("rankAlternatives", () => {
  it("keeps only what's Safe for them and ranks by the biggest sugar drop", () => {
    const ranked = rankAlternatives({
      original: context({ sugar_per_100g: 30 }),
      candidates: [
        candidate("a bit sweet", { sugar_per_100g: 4 }),
        candidate("still sweet", { sugar_per_100g: 10 }), // Caution: out
        candidate("sugar unknown", {}), // can't claim "less sugar": out
        candidate("barely sweet", { sugar_per_100g: 1 }),
      ],
      members: [papa],
      ruleFacts,
      limit: 5,
    });
    assert.deepEqual(
      ranked.map((r) => r.item),
      ["barely sweet", "a bit sweet"]
    );
    assert.deepEqual(ranked[0].improvements, [
      // Meter against the strictest limit that flagged it (FSSAI 5 g).
      {
        kind: "less",
        label: "97% less sugar",
        value: 1,
        original: 30,
        limit: 5,
        unit: "g",
      },
    ]);
  });

  it("must be Safe for every one of them, allergies included", () => {
    const amma = member([], ["peanuts"]);
    const ranked = rankAlternatives({
      original: context({ sugar_per_100g: 30 }, ["Groundnut Oil"]),
      candidates: [
        candidate("peanut-free", { sugar_per_100g: 2 }, ["Sunflower Oil"]),
        candidate("low sugar, peanuts", { sugar_per_100g: 1 }, [
          "Groundnut Oil",
        ]),
      ],
      members: [papa, amma],
      ruleFacts,
      limit: 5,
    });
    assert.deepEqual(
      ranked.map((r) => r.item),
      ["peanut-free"]
    );
    assert.deepEqual(
      ranked[0].improvements.map((i) => i.label),
      ["93% less sugar", "No peanuts"]
    );
  });

  it("names the non-numeric flags it's free of", () => {
    const ranked = rankAlternatives({
      original: context({
        sugar_per_100g: 2,
        nova_group: 4,
        additive_count: 6,
      }),
      candidates: [candidate("simple", { sugar_per_100g: 1, nova_group: 1 })],
      members: [member(["hypertensive"])],
      ruleFacts,
      limit: 5,
    });
    // In the original verdict's reason order (worst first).
    assert.deepEqual(
      ranked[0].improvements.map((i) => i.label),
      ["Fewer additives", "Less processed"]
    );
  });

  it("returns nothing when there's nobody to find something better for", () => {
    assert.deepEqual(
      rankAlternatives({
        original: context({ sugar_per_100g: 30 }),
        candidates: [candidate("plain", { sugar_per_100g: 1 })],
        members: [],
        ruleFacts,
        limit: 5,
      }),
      []
    );
  });

  it("returns at most `limit`", () => {
    const ranked = rankAlternatives({
      original: context({ sugar_per_100g: 30 }),
      candidates: [1, 2, 3, 4].map((sugar) =>
        candidate(`s${sugar}`, { sugar_per_100g: sugar })
      ),
      members: [papa],
      ruleFacts,
      limit: 2,
    });
    assert.deepEqual(
      ranked.map((r) => r.item),
      ["s1", "s2"]
    );
  });
});
