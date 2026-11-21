import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoriesOn, shelfOf } from "./shelves";

describe("shelves", () => {
  it("puts unevenly filed catalogue categories on one shelf", () => {
    // Malt drinks arrive under several Open Food Facts categories.
    assert.equal(shelfOf("Barley malt flours"), "Tea, coffee & health drinks");
    assert.equal(shelfOf("Chips"), "Salty snacks");
    assert.equal(shelfOf("Potatoes"), "Salty snacks");
  });

  it("keeps oils and ghee off the sauces shelf", () => {
    // Ketchup was offered ghee and sunflower oil as better options.
    assert.equal(shelfOf("Dressings and sauces"), "Sauces & pickles");
    assert.equal(shelfOf("Salty and fatty products"), "Sauces & pickles");
    assert.equal(shelfOf("Fats"), "Oils & ghee");
  });

  it("reads a shelf name however a label read capitalises it", () => {
    assert.equal(shelfOf("salty Snacks "), "Salty snacks");
  });

  it("has no shelf for a category it doesn't know", () => {
    assert.equal(shelfOf("unknown"), null);
    assert.equal(shelfOf("BISCUITS"), null);
  });

  it("finds a shelf's products under its own name and every category on it", () => {
    assert.deepEqual(categoriesOn("Biscuits & cakes"), [
      "Biscuits & cakes",
      "Biscuits and cakes",
      "Snacks",
      "Pastries",
    ]);
  });
});
