import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AllergenCode } from "@foodscanner/shared";
import { allergenEvidence, allergensIn } from "./allergen-evidence";

describe("allergensIn", () => {
  // Real Indian label wording -> what must be found.
  const finds: Array<[string, AllergenCode[]]> = [
    ["Refined Wheat Flour (Maida)", ["gluten"]],
    ["Atta", ["gluten"]],
    ["Suji", ["gluten"]],
    ["Rava", ["gluten"]],
    ["Barley Malt Extract", ["gluten"]],
    ["Milk Solids", ["milk"]],
    ["Ghee", ["milk"]],
    ["Paneer", ["milk"]],
    ["Khoa", ["milk"]],
    ["Butter (3%)", ["milk"]],
    ["Buttermilk Powder", ["milk"]],
    ["Whey Powder", ["milk"]],
    ["Groundnut Oil", ["peanuts"]],
    ["Roasted Peanuts", ["peanuts"]],
    ["Cashew Nuts (Kaju)", ["tree_nuts"]],
    ["Badam", ["tree_nuts"]],
    ["Pista", ["tree_nuts"]],
    ["Mixed Nuts", ["tree_nuts"]],
    ["Til (Sesame Seeds)", ["sesame"]],
    ["Gingelly Oil", ["sesame"]],
    ["Mustard Seeds (Rai)", ["mustard"]],
    ["Sarson Oil", ["mustard"]],
    ["Soya Lecithin", ["soy"]],
    ["Emulsifier (Soy Lecithin)", ["soy"]],
    ["Egg Powder", ["egg"]],
    ["Dried Prawns", ["shellfish"]],
    ["Crustaceans", ["shellfish"]],
    ["Anchovy Extract", ["fish"]],
    ["Preservative (223)", ["sulphites"]],
    ["Preservative (INS 224)", ["sulphites"]],
    ["Sodium Metabisulphite", ["sulphites"]],
  ];
  for (const [ingredient, expected] of finds) {
    it(`finds ${expected.join(", ")} in "${ingredient}"`, () => {
      assert.deepEqual(allergensIn(ingredient), expected);
    });
  }

  // Look-alikes that must NOT count.
  const clean = [
    "Coconut Milk",
    "Desiccated Coconut",
    "Cocoa Butter",
    "Peanut Butter Flavour (Artificial)", // peanuts yes, milk no
    "Buckwheat Flour",
    "Maltodextrin",
    "Eggless Mayonnaise Base",
    "Nutmeg",
    "Areca Nut",
    "Cream of Tartar",
    "Rice Bran Oil",
    "Sunflower Oil",
  ];
  for (const ingredient of clean) {
    it(`doesn't over-read "${ingredient}"`, () => {
      const found = allergensIn(ingredient);
      if (ingredient.startsWith("Peanut Butter")) {
        assert.deepEqual(found, ["peanuts"]);
      } else if (ingredient.startsWith("Eggless Mayonnaise")) {
        // "mayonnaise" alone means egg; "eggless" is a claim we don't trust.
        assert.deepEqual(found, ["egg"]);
      } else {
        assert.deepEqual(found, []);
      }
    });
  }
});

describe("allergenEvidence", () => {
  it("treats everything after a 'may contain' line as cross-contact", () => {
    const evidence = allergenEvidence({
      ingredients: ["Maida", "Sugar", "May contain traces of nuts", "Milk"],
      declared: null,
    });
    assert.deepEqual(evidence.findings.gluten?.presence, "contains");
    assert.deepEqual(evidence.findings.tree_nuts?.presence, "may_contain");
    assert.deepEqual(evidence.findings.milk?.presence, "may_contain");
  });

  it("catches the common 'MAY CONTAINS' spelling too", () => {
    // Real OFF entry for Indonesian instant noodles sold in India.
    const evidence = allergenEvidence({
      ingredients: ["Maida", "MAY CONTAINS CRUSTACEAN", "FISH", "EGG"],
      declared: null,
    });
    assert.equal(evidence.findings.gluten?.presence, "contains");
    assert.equal(evidence.findings.shellfish?.presence, "may_contain");
    assert.equal(evidence.findings.fish?.presence, "may_contain");
    assert.equal(evidence.findings.egg?.presence, "may_contain");
  });

  it("adds what the pack declares, and 'contains' beats 'may contain'", () => {
    const evidence = allergenEvidence({
      ingredients: ["Sugar", "May contain milk"],
      declared: { contains: ["milk", "soy"], may_contain: ["sesame"] },
    });
    assert.deepEqual(evidence.findings.milk, {
      presence: "contains",
      ingredient: null,
    });
    assert.equal(evidence.findings.soy?.presence, "contains");
    assert.equal(evidence.findings.sesame?.presence, "may_contain");
  });

  it("keeps the ingredient that matched, for the reason text", () => {
    const evidence = allergenEvidence({
      ingredients: ["Groundnut Oil "],
      declared: { contains: ["peanuts"], may_contain: [] },
    });
    assert.deepEqual(evidence.findings.peanuts, {
      presence: "contains",
      ingredient: "Groundnut Oil",
    });
  });

  it("knows when there was no ingredient list to check", () => {
    assert.equal(
      allergenEvidence({ ingredients: [], declared: null }).hasIngredientList,
      false
    );
  });
});
