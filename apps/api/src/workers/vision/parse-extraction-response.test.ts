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
