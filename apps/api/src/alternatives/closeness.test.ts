import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeness } from "./closeness";

// Real catalogue products on the "Sauces & pickles" shelf.
const kissan = {
  name: "Kissan No onion no garlic Tomato Ketchup",
  brand: "Kissan",
  category: "Dressings and sauces",
};

describe("closeness", () => {
  it("puts another ketchup first, whatever its brand", () => {
    assert.equal(
      closeness(kissan, {
        name: "Pichkoo RICH TOMATO KETCHUP",
        brand: "Pichkoo",
        category: "Dressings and sauces",
      }),
      0
    );
  });

  it("puts a sauce from the same category next", () => {
    assert.equal(
      closeness(kissan, {
        name: "Veg mayonnaise for burger",
        brand: "Veeba",
        category: "Dressings and sauces",
      }),
      1
    );
  });

  it("puts the rest of the shelf last", () => {
    assert.equal(
      closeness(kissan, {
        name: "Achard legumes",
        brand: "Unknown",
        category: "Salty and fatty products",
      }),
      2
    );
  });

  it("doesn't count the brand or filler words as a match", () => {
    // Same brand, different kind: Kissan jam is no ketchup swap.
    assert.equal(
      closeness(kissan, {
        name: "Kissan Mixed Fruit Jam",
        brand: "Kissan",
        category: "Sweets",
      }),
      2
    );
    assert.equal(
      closeness(
        { name: "Rich Tomato Ketchup", brand: "X", category: "A" },
        { name: "Rich Chocolate Spread", brand: "Y", category: "B" }
      ),
      2
    );
  });
});
