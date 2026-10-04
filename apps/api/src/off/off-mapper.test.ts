import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ingredientsFromProduct,
  isLiquidProduct,
  mapOffProduct,
  nutritionFromProduct,
  numberOrUndefined,
} from "./off-mapper";

describe("ingredientsFromProduct", () => {
  it("prefers the structured ingredients array over the raw text", () => {
    const result = ingredientsFromProduct({
      ingredients: [{ text: "Sugar" }, { text: "Salt" }],
      ingredients_text: "This should be ignored",
    });
    assert.deepEqual(result, ["Sugar", "Salt"]);
  });

  it("falls back to splitting ingredients_text when no structured array is present", () => {
    const result = ingredientsFromProduct({
      ingredients_text: "Sugar, Salt, Palm Oil",
    });
    assert.deepEqual(result, ["Sugar", "Salt", "Palm Oil"]);
  });

  it("returns an empty array when neither is present", () => {
    assert.deepEqual(ingredientsFromProduct({}), []);
  });
});

describe("isLiquidProduct", () => {
  it("trusts product_quantity_unit when present", () => {
    assert.equal(isLiquidProduct({ product_quantity_unit: "ML" }), true);
    assert.equal(isLiquidProduct({ product_quantity_unit: "g" }), false);
  });

  it("falls back to spotting ml in the free-text quantity", () => {
    assert.equal(isLiquidProduct({ quantity: "500 ml" }), true);
    assert.equal(isLiquidProduct({ quantity: "500 g" }), false);
  });

  it("falls back to beverage category tags as a last resort", () => {
    assert.equal(isLiquidProduct({ categories_tags: ["en:beverages"] }), true);
    assert.equal(isLiquidProduct({ categories_tags: ["en:snacks"] }), false);
  });

  it("defaults to solid when nothing indicates liquid", () => {
    assert.equal(isLiquidProduct({}), false);
  });
});

describe("nutritionFromProduct", () => {
  it("maps sugar directly and converts sodium grams to milligrams for a solid product", () => {
    const result = nutritionFromProduct({
      nutriments: { sugars_100g: 15.5, sodium_100g: 0.12 },
    });
    assert.equal(result.sugar_per_100g, 15.5);
    assert.equal(result.sodium_per_100g, 120);
    assert.equal(result.sugar_per_100ml, undefined);
  });

  it("uses the _per_100ml keys for a liquid product", () => {
    const result = nutritionFromProduct({
      quantity: "300 ml",
      nutriments: { sugars_100g: 10, sodium_100g: 0.01 },
    });
    assert.equal(result.sugar_per_100ml, 10);
    assert.equal(result.sodium_per_100ml, 10);
    assert.equal(result.sugar_per_100g, undefined);
  });

  it("omits a nutrient entirely when OFF doesn't report it", () => {
    const result = nutritionFromProduct({ nutriments: {} });
    assert.deepEqual(result, {});
  });

  it("treats an out-of-range per-100g value as missing rather than using it", () => {
    // Real case found seeding production data: sodium_100g: 118 — a
    // contributor entered milligrams into a grams-documented field.
    // 118g of sodium in 100g of product is physically impossible.
    const result = nutritionFromProduct({
      nutriments: { sugars_100g: 37, sodium_100g: 118 },
    });
    assert.equal(result.sugar_per_100g, 37);
    assert.equal(result.sodium_per_100g, undefined);
  });
});

describe("numberOrUndefined", () => {
  it("accepts finite numbers and numeric strings", () => {
    assert.equal(numberOrUndefined(5), 5);
    assert.equal(numberOrUndefined("5.5"), 5.5);
  });

  it("rejects NaN, empty strings, and non-numeric input", () => {
    assert.equal(numberOrUndefined(NaN), undefined);
    assert.equal(numberOrUndefined(""), undefined);
    assert.equal(numberOrUndefined("not a number"), undefined);
    assert.equal(numberOrUndefined(undefined), undefined);
  });
});

describe("mapOffProduct", () => {
  it("returns null when there are no usable ingredients", () => {
    assert.equal(mapOffProduct({ product_name: "Mystery Snack" }), null);
  });

  it("maps a complete product with scaled confidence", () => {
    const result = mapOffProduct({
      product_name: "Parle-G",
      brands: "Parle,Other",
      categories: "Biscuits,Snacks",
      ingredients: [{ text: "Wheat Flour" }, { text: "Sugar" }],
      nutriments: { sugars_100g: 20, sodium_100g: 0.2 },
      nova_group: 4,
      additives_n: 2,
      states_tags: ["en:ingredients-completed", "en:nutrition-facts-completed"],
    });
    assert.ok(result);
    assert.equal(result?.name, "Parle-G");
    assert.equal(result?.brand, "Parle");
    assert.equal(result?.category, "Biscuits");
    assert.equal(result?.nova_group, 4);
    assert.equal(result?.additive_count, 2);
    assert.equal(result?.extraction_confidence, 0.9);
  });

  it("defaults name/brand/category to unknown when OFF doesn't have them", () => {
    const result = mapOffProduct({ ingredients_text: "Sugar" });
    assert.equal(result?.name, "unknown");
    assert.equal(result?.brand, "unknown");
    assert.equal(result?.category, "unknown");
  });
});
