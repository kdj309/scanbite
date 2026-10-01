import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

  it("throws when the JSON doesn't match the schema", () => {
    assert.throws(() =>
      parseExtractionResponse(JSON.stringify({ name: "Missing fields" }))
    );
  });

  it("throws on unparseable text", () => {
    assert.throws(() => parseExtractionResponse("not json at all"));
  });
});
