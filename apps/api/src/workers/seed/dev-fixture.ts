import type { ExtractionOutput } from "../vision/extraction-output";

/** Known barcode seeded in development so GET /products/:barcode works without AI. */
export const DEV_FIXTURE_BARCODE = "8900000000000";

export const DEV_FIXTURE_EXTRACTION: ExtractionOutput = {
  name: "Fixture Oats",
  brand: "ScanBite",
  category: "breakfast",
  ingredients: [],
  nutrition: { sugar_per_100g: 20 },
  nova_group: 1,
  additive_count: 0,
  extraction_confidence: 1,
};
