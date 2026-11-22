import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankSearchMatches } from "./product-search";

const p = (name: string, brand = "Brand") => ({ name, brand });

describe("rankSearchMatches", () => {
  it("puts names that start with the query first", () => {
    const ranked = rankSearchMatches(
      [p("Choco Biscuit Cream"), p("Biscuit Classic"), p("Digestive Biscuits")],
      "bis"
    );
    assert.deepEqual(
      ranked.map((m) => m.name),
      ["Biscuit Classic", "Choco Biscuit Cream", "Digestive Biscuits"]
    );
  });

  it("ranks a word match above a brand match, and a brand match above the rest", () => {
    const ranked = rankSearchMatches(
      [
        p("Cream Rolls", "Parle"),
        p("Marie Gold", "Britannia"),
        p("Parle-G Glucose", "Parle"),
      ],
      "par"
    );
    assert.deepEqual(
      ranked.map((m) => m.name),
      ["Parle-G Glucose", "Cream Rolls", "Marie Gold"]
    );
  });

  it("keeps the given order within a tier, and ignores case", () => {
    const ranked = rankSearchMatches(
      [p("OATS masala"), p("Oats plain")],
      "oats"
    );
    assert.deepEqual(
      ranked.map((m) => m.name),
      ["OATS masala", "Oats plain"]
    );
  });

  it("finds word starts after punctuation, and inside the brand", () => {
    const ranked = rankSearchMatches(
      [
        p("Plain Rusk", "Kwik"),
        p("Rolls", "Zorbit Foods"),
        p("Choco (Zorbit) Cream"),
      ],
      "zorbit"
    );
    assert.deepEqual(
      ranked.map((m) => m.name),
      ["Choco (Zorbit) Cream", "Rolls", "Plain Rusk"]
    );
  });
});
