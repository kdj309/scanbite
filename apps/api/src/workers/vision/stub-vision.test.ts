import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractionOutputSchema } from "./extraction-output";
import {
  StubVisionAdapter,
  STUB_LABEL_EXTRACTION,
} from "./stub-vision.adapter";
import { DEV_FIXTURE_BARCODE } from "../seed/dev-fixture";

describe("StubVisionAdapter", () => {
  const vision = new StubVisionAdapter();

  it("returns schema-valid JSON for an unknown barcode", async () => {
    const result = await vision.extract({
      barcode: "999",
      photoKey: "labels/999/hash.jpg",
    });
    assert.deepEqual(
      extractionOutputSchema.parse(result),
      STUB_LABEL_EXTRACTION
    );
    assert.equal(result.nutrition.sugar_per_100g, 24);
    assert.equal(result.nova_group, 4);
    assert.equal(result.additive_count, 4);
    assert.ok(result.ingredients.includes("Palm Oil"));
  });

  it("returns the seeded fixture extraction for the fixture barcode", async () => {
    const result = await vision.extract({
      barcode: DEV_FIXTURE_BARCODE,
      photoKey: "labels/fixture/hash.jpg",
    });
    assert.equal(result.name, "Fixture Oats");
    assert.equal(result.nutrition.sugar_per_100g, 20);
    assert.equal(result.extraction_confidence, 1);
  });
});
