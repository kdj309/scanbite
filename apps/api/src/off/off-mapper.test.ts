import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ingredientsFromProduct,
  isLiquidProduct,
  mapOffProduct,
  nutritionFromProduct,
  declaredAllergens,
  declaredVeg,
  numberOrUndefined,
  offImageUrl,
  offQuantity,
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
    assert.equal(isLiquidProduct({ product_quantity_unit: "l" }), true);
    assert.equal(isLiquidProduct({ product_quantity_unit: "g" }), false);
  });

  it("falls back to spotting ml in the free-text quantity", () => {
    assert.equal(isLiquidProduct({ quantity: "500 ml" }), true);
    // Litres too — missing these made drinks score against solid limits.
    for (const quantity of ["1.25 l", "2L", "1 litre", "1.5 Liters"]) {
      assert.equal(isLiquidProduct({ quantity }), true, quantity);
    }
    for (const quantity of [
      "250 g",
      "1 kg",
      "12 pieces",
      "Pack of 10 lollipops",
      "125 mL / 67 g", // ice cream: either basis — not a clear drink
    ]) {
      assert.equal(isLiquidProduct({ quantity }), false, quantity);
    }
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

  it("treats sodium a drink can't physically hold as missing (Coca-Cola India)", () => {
    // OFF 8901764012808: sodium_100g 25 (g) — 25 mg typed as grams.
    const result = nutritionFromProduct({
      product_quantity_unit: "ml",
      nutriments: { sugars_100g: 11, sodium_100g: 25 },
    });
    assert.equal(result.sugar_per_100ml, 11);
    assert.equal(result.sodium_per_100ml, undefined);
  });

  it("keeps real high-sodium and high-sugar liquids", () => {
    const soySauce = nutritionFromProduct({
      quantity: "200 ml",
      nutriments: { sodium_100g: 5.6 },
    });
    assert.equal(soySauce.sodium_per_100ml, 5600);
    const syrup = nutritionFromProduct({
      quantity: "750 ml",
      nutriments: { sugars_100g: 80 },
    });
    assert.equal(syrup.sugar_per_100ml, 80);
  });

  it("keeps salt itself but not more sodium than salt contains", () => {
    assert.equal(
      nutritionFromProduct({ nutriments: { sodium_100g: 38.7 } })
        .sodium_per_100g,
      38700
    );
    assert.equal(
      nutritionFromProduct({ nutriments: { sodium_100g: 45 } }).sodium_per_100g,
      undefined
    );
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
      image_front_url: "https://images.openfoodfacts.org/front.jpg",
      quantity: " 250 g ",
    });
    assert.ok(result);
    assert.equal(
      result?.image_url,
      "https://images.openfoodfacts.org/front.jpg"
    );
    assert.equal(result?.quantity, "250 g");
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
    assert.equal(result?.image_url, null);
    assert.equal(result?.quantity, null);
    assert.equal(result?.brand, "unknown");
    assert.equal(result?.category, "unknown");
  });
});

describe("offImageUrl", () => {
  it("accepts only https images on OFF's own image host", () => {
    const ok =
      "https://images.openfoodfacts.org/images/products/123/front_en.5.400.jpg";
    assert.equal(offImageUrl(` ${ok} `), ok);
    for (const bad of [
      "http://images.openfoodfacts.org/front.jpg",
      "https://tracker.example.com/pixel.gif",
      "https://images.openfoodfacts.org.evil.com/front.jpg",
      "javascript:alert(1)",
      "not a url",
      undefined,
    ]) {
      assert.equal(offImageUrl(bad), null, String(bad));
    }
  });
});

describe("offQuantity", () => {
  it("trims pack sizes and drops empty or runaway text", () => {
    assert.equal(offQuantity(" 1.25 l "), "1.25 l");
    assert.equal(offQuantity("   "), null);
    assert.equal(offQuantity("x".repeat(51)), null);
    assert.equal(offQuantity(undefined), null);
  });
});

describe("declaredAllergens", () => {
  it("maps OFF's allergen and trace tags to our codes", () => {
    assert.deepEqual(
      declaredAllergens({
        allergens_tags: ["en:gluten", "en:milk", "en:soybeans", "en:celery"],
        traces_tags: ["en:nuts", "en:crustaceans", "en:molluscs"],
      }),
      {
        contains: ["gluten", "milk", "soy"],
        may_contain: ["tree_nuts", "shellfish"],
      }
    );
  });

  it("is null — not 'declares none' — when OFF has no allergen data", () => {
    assert.equal(declaredAllergens({}), null);
  });
});

describe("declaredVeg", () => {
  it("reads the pack's FSSAI symbol from OFF labels", () => {
    assert.equal(declaredVeg({ labels_tags: ["en:vegetarian"] }), "veg");
    assert.equal(
      declaredVeg({ labels_tags: ["en:non-vegetarian"] }),
      "non_veg"
    );
    assert.equal(declaredVeg({ labels_tags: ["en:no-palm-oil"] }), null);
    assert.equal(declaredVeg({}), null);
  });

  it("lets non-veg win if both labels were entered", () => {
    assert.equal(
      declaredVeg({ labels_tags: ["en:vegetarian", "en:non-vegetarian"] }),
      "non_veg"
    );
  });
});
