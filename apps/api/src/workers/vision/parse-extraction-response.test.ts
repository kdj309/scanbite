import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unlistedNutritionKeys } from "./extraction-output";
import { parseExtractionResponse } from "./parse-extraction-response";

const VALID_JSON = JSON.stringify({
  name: "Test Product",
  brand: "TestBrand",
  category: "snacks",
  ingredients: ["Sugar", "Salt"],
  nutrition: { sugar_per_100g: 10 },
  nova_group: 4,
  additive_count: 1,
  extraction_confidence: 0.8,
  photo_consistency: "consistent",
});

describe("parseExtractionResponse", () => {
  it("parses a bare JSON response", () => {
    const result = parseExtractionResponse(VALID_JSON);
    assert.equal(result.name, "Test Product");
    assert.equal(result.photo_consistency, "consistent");
  });

  it("strips a markdown code fence before parsing", () => {
    const fenced = "```json\n" + VALID_JSON + "\n```";
    const result = parseExtractionResponse(fenced);
    assert.equal(result.brand, "TestBrand");
  });

  it("reads nova_group: null (which the prompt allows) as not known", () => {
    const unknownNova = VALID_JSON.replace(
      '"nova_group":4',
      '"nova_group":null'
    );
    assert.equal(parseExtractionResponse(unknownNova).nova_group, undefined);
  });

  it('reads a label\'s "NIL" as 0, so the rules can use it', () => {
    const nil = VALID_JSON.replace(
      '"nutrition":{"sugar_per_100g":10}',
      '"nutrition":{"sugar_per_100g":"NIL","added_sugar_per_100g":"Nil"}'
    );
    assert.deepEqual(parseExtractionResponse(nil).nutrition, {
      sugar_per_100g: 0,
      added_sugar_per_100g: 0,
    });
  });

  it("converts values copied as printed into the units the rules use", () => {
    // A real label (Delhi mixture): sodium printed in grams, as a limit.
    const printed = VALID_JSON.replace(
      '"nutrition":{"sugar_per_100g":10}',
      `"nutrition":${JSON.stringify({
        energy_kcal_per_100g: "574.78 kcal",
        protein_per_100g: "17.47g",
        total_fat_per_100g: "39.58 g",
        sodium_per_100g: "<0.1 g",
        sugar_per_100g: "<0.1g",
        cholesterol_per_100g: "12 mg",
      })}`
    );
    assert.deepEqual(parseExtractionResponse(printed).nutrition, {
      energy_kcal_per_100g: 574.78,
      protein_per_100g: 17.47,
      total_fat_per_100g: 39.58,
      sodium_per_100g: 100,
      sugar_per_100g: 0.1,
      cholesterol_per_100g: 12,
    });
  });

  it("converts sodium in mg, energy in kJ, and keeps unreadable text", () => {
    const printed = VALID_JSON.replace(
      '"nutrition":{"sugar_per_100g":10}',
      `"nutrition":${JSON.stringify({
        sodium_per_100g: "480 mg",
        energy_kcal_per_100g: "2092 kJ",
        sugar_per_100g: "see pack",
        protein_per_100g: 7.2,
      })}`
    );
    assert.deepEqual(parseExtractionResponse(printed).nutrition, {
      sodium_per_100g: 480,
      energy_kcal_per_100g: 500,
      sugar_per_100g: "see pack",
      protein_per_100g: 7.2,
    });
  });

  it("reads Indian label spellings, footnote marks and thousands separators", () => {
    const printed = VALID_JSON.replace(
      '"nutrition":{"sugar_per_100g":10}',
      `"nutrition":${JSON.stringify({
        protein_per_100g: "7.2 gm",
        sodium_per_100g: "0.48 gms",
        trans_fat_per_100g: "Nil g",
        saturated_fat_per_100g: "0 g*",
        energy_kcal_per_100g: "2,092 kJ",
        cholesterol_per_100g: "1500 μg",
      })}`
    );
    assert.deepEqual(parseExtractionResponse(printed).nutrition, {
      protein_per_100g: 7.2,
      sodium_per_100g: 480,
      trans_fat_per_100g: 0,
      saturated_fat_per_100g: 0,
      energy_kcal_per_100g: 500,
      cholesterol_per_100g: 1.5,
    });
  });

  it("drops nutrition keys the rules don't read, keeping the rest", () => {
    const extra = VALID_JSON.replace(
      '"nutrition":{"sugar_per_100g":10}',
      '"nutrition":{"sugar_per_100g":10,"dietary_fibre_per_100g":3}'
    );
    assert.deepEqual(parseExtractionResponse(extra).nutrition, {
      sugar_per_100g: 10,
    });
  });

  it("names the dropped keys, so a renamed nutrient can be spotted", () => {
    assert.deepEqual(
      unlistedNutritionKeys({ sodium_mg_per_100g: 5203, sugar_per_100g: 0 }),
      ["sodium_mg_per_100g"]
    );
  });

  it("throws when the JSON doesn't match the schema", () => {
    assert.throws(() =>
      parseExtractionResponse(JSON.stringify({ name: "Missing fields" }))
    );
  });

  it("throws on unparseable text", () => {
    assert.throws(() => parseExtractionResponse("not json at all"));
  });
});
