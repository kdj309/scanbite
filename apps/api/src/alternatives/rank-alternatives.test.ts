import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenCode, HealthConditionCode } from "@foodscanner/shared";
import { allergenEvidence } from "../allergens/allergen-evidence";
import type { ProductContext } from "../personalization/household-verdict";
import { evaluateRules, passedRules } from "../scoring/evaluate-rules";
import { HLD_EXAMPLE_RULES } from "../scoring/hld-example-rules";
import { HLD_PERSONALIZATION_SEEDS } from "../workers/seed/hld-seed";
import {
  rankAlternatives,
  rankCautionAlternatives,
  type RuleFacts,
} from "./rank-alternatives";

// The real dev seed rules: FSSAI/UK sugar + salt, palm oil, additives,
// NOVA, the diabetic sugar escalation and the condition salt rules.
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
        sodium_per_100g: 50,
        nova_group: 4,
        additive_count: 6,
      }),
      // Salt known and low, or it couldn't be Safe for someone with BP.
      candidates: [
        candidate("simple", {
          sugar_per_100g: 1,
          sodium_per_100g: 50,
          nova_group: 1,
        }),
      ],
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

describe("rankCautionAlternatives", () => {
  const everyone = member([]);
  // Kissan ketchup: 29.8 g sugar is Avoid (UK red line, 22.5 g).
  const ketchup = context({ sugar_per_100g: 29.8 });

  it("offers Caution swaps that are better on what flagged it (real case)", () => {
    const ranked = rankCautionAlternatives({
      original: ketchup,
      candidates: [
        // Sugar-free ketchup: 3 g sugar but 1,120 mg sodium.
        candidate("sugar free", { sugar_per_100g: 3, sodium_per_100g: 1120 }),
        candidate("still Avoid", { sugar_per_100g: 25, sodium_per_100g: 50 }),
        candidate("already Safe", { sugar_per_100g: 1, sodium_per_100g: 50 }),
        candidate("sugar unknown", { sodium_per_100g: 1120 }),
      ],
      members: [everyone],
      ruleFacts,
      limit: 3,
    });
    assert.deepEqual(
      ranked.map((r) => r.item),
      ["sugar free"]
    );
    assert.deepEqual(
      ranked[0].improvements.map((i) => i.label),
      ["90% less sugar"]
    );
    assert.deepEqual(ranked[0].stillFlagged, [
      ruleLabels.fssai_cannot_claim_low_sodium,
    ]);
  });

  it("must be lower on every number that flagged the original", () => {
    const ranked = rankCautionAlternatives({
      original: context({ sugar_per_100g: 30, sodium_per_100g: 500 }),
      candidates: [
        candidate("less sugar, more salt", {
          sugar_per_100g: 10,
          sodium_per_100g: 600,
        }),
        candidate("less of both", { sugar_per_100g: 10, sodium_per_100g: 300 }),
      ],
      members: [everyone],
      ruleFacts,
      limit: 3,
    });
    assert.deepEqual(
      ranked.map((r) => r.item),
      ["less of both"]
    );
  });

  it("offers nothing when the original is only Caution", () => {
    assert.deepEqual(
      rankCautionAlternatives({
        original: context({ sugar_per_100g: 10 }),
        candidates: [candidate("less sugar", { sugar_per_100g: 6 })],
        members: [everyone],
        ruleFacts,
        limit: 3,
      }),
      []
    );
  });

  it("never claims free of something it couldn't check", () => {
    // Avoid for Amma (peanuts) and for everyone (sugar). The candidate has
    // no ingredient list, so its peanut check is a gap, not a pass.
    const amma = member([], ["peanuts"]);
    const ranked = rankCautionAlternatives({
      original: context({ sugar_per_100g: 29.8 }, ["Groundnut Oil"]),
      candidates: [candidate("ingredients unread", { sugar_per_100g: 3 }, [])],
      members: [everyone, amma],
      ruleFacts,
      limit: 3,
    });
    // Offered for its lower sugar, but with no allergy claim.
    assert.deepEqual(
      ranked.map((r) => r.improvements.map((i) => i.label)),
      [["90% less sugar"]]
    );
  });

  it("never offers something Avoid for any of them", () => {
    const amma = member([], ["peanuts"]);
    const ranked = rankCautionAlternatives({
      original: ketchup,
      candidates: [
        candidate(
          "sugar free, peanuts",
          { sugar_per_100g: 3, sodium_per_100g: 1120 },
          ["Groundnut Oil"]
        ),
      ],
      members: [everyone, amma],
      ruleFacts,
      limit: 3,
    });
    assert.deepEqual(ranked, []);
  });
});
