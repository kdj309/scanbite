import type { ExtractionOutput } from "./extraction-output";

export const VISION_PORT = "VISION_PORT";

export interface VisionPort {
  /** photoKeys: 1-3 photos of the same product, sent to the model in a single call. */
  extract(input: {
    barcode: string;
    photoKeys: string[];
  }): Promise<ExtractionOutput>;
}
