import { Injectable } from "@nestjs/common";
import {
  DEV_FIXTURE_BARCODE,
  DEV_FIXTURE_EXTRACTION,
} from "../seed/dev-fixture";
import {
  extractionOutputSchema,
  type ExtractionOutput,
} from "./extraction-output";
import type { VisionPort } from "./vision.port";

/** Canned label that exercises the HLD §6b example rules (sugar, palm oil, additives, NOVA 4). */
export const STUB_LABEL_EXTRACTION: ExtractionOutput =
  extractionOutputSchema.parse({
    name: "Stub Label Product",
    brand: "ScanBite",
    category: "packaged",
    ingredients: [
      "Sugar",
      "Palm Oil",
      "Wheat Flour",
      "E322",
      "E330",
      "Salt",
      "Flavour",
    ],
    nutrition: { sugar_per_100g: 24 },
    nova_group: 4,
    additive_count: 4,
    extraction_confidence: 0.95,
    photo_consistency: "consistent",
  });

@Injectable()
export class StubVisionAdapter implements VisionPort {
  async extract(input: {
    barcode: string;
    photoKeys: string[];
  }): Promise<ExtractionOutput> {
    void input.photoKeys;
    if (input.barcode === DEV_FIXTURE_BARCODE) {
      return DEV_FIXTURE_EXTRACTION;
    }
    return STUB_LABEL_EXTRACTION;
  }
}
