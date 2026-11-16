import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRules } from "./evaluate-rules";
import { factsFromVersion } from "./facts";
import { applyPersonalization } from "../personalization/apply-personalization";
import { HLD_PERSONALIZATION_SEEDS } from "../workers/seed/hld-seed";
import { HLD_EXAMPLE_RULES } from "./hld-example-rules";

/** A real label: Divine Crunchy Butterscotch ice cream, per 100 ml. */
const DIVINE: {
  category: string;
  ingredients: [];
  nutrition: Record<string, number>;
} = {
  category: "Ice cream",
  ingredients: [],
  nutrition: {
    energy_kcal_per_100ml: 121,
    sugar_per_100ml: 11.9,
    total_fat_per_100ml: 5.8,
    sodium_per_100ml: 31.5,
  },
};

const facts = (fields: Partial<typeof DIVINE>) =>
  factsFromVersion({ ...DIVINE, ...fields }, []);

const flagged = (fields: Partial<typeof DIVINE>) =>
  evaluateRules(facts(fields), HLD_EXAMPLE_RULES).breakdown.map(
    (item) => item.rule_id
  );

describe("dessert groups", () => {
  it("never scores ice cream as a drink, though its label is per 100 ml", () => {
    const iceCream = facts({});
    assert.equal(iceCream.product_form, "frozen_dessert");
    // The declared per-100 ml values are what its limits read.
    assert.equal(iceCream.sugar_per_100g, 11.9);
  });

  it("passes the WHO frozen-dessert limits just under 12 g sugar", () => {
    assert.deepEqual(flagged({}), []);
  });

  it("flags sugar over the frozen-dessert limit, not a drink's", () => {
    assert.deepEqual(
      flagged({ nutrition: { ...DIVINE.nutrition, sugar_per_100ml: 13 } }),
      ["who_frozen_dessert_sugar"]
    );
  });

  it("holds dairy desserts to their own, stricter sugar limit", () => {
    assert.deepEqual(flagged({ category: "Dairy desserts" }), [
      "who_curded_dessert_sugar",
    ]);
    assert.equal(
      facts({ category: "Dairy desserts" }).product_form,
      "curded_dessert"
    );
  });

  it("gives a dessert of unknown kind the general solid rules", () => {
    const unsure = facts({ category: "Desserts & ice cream" });
    assert.equal(unsure.product_form, "solid");
    assert.deepEqual(flagged({ category: "Desserts & ice cream" }), [
      "fssai_cannot_claim_low_sugar",
    ]);
  });

  it("still scores milk per 100 ml as a drink", () => {
    const milk = facts({
      category: "Milk and yogurt",
      nutrition: { sugar_per_100ml: 4.7, sodium_per_100ml: 44 },
    });
    assert.equal(milk.product_form, "liquid");
    assert.equal(milk.sugar_per_100g, undefined);
  });

  it("still raises a salty dessert for high blood pressure", () => {
    const kulfi = facts({
      nutrition: { ...DIVINE.nutrition, sodium_per_100ml: 400 },
    });
    const base = evaluateRules(kulfi, HLD_EXAMPLE_RULES);
    const overlay = applyPersonalization({
      base,
      facts: kulfi,
      memberConditions: ["hypertensive"],
      rules: HLD_PERSONALIZATION_SEEDS,
    });
    assert.deepEqual(
      overlay.flags.map((flag) => [flag.rule_id, flag.severity]),
      [["hypertensive_sodium_escalation_frozen_dessert", "red"]]
    );
  });
});
