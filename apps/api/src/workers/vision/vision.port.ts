import type { ExtractionOutput } from "./extraction-output";

export const VISION_PORT = "VISION_PORT";

export interface VisionPort {
  /** photoKeys: 1..MAX_SUBMISSION_PHOTOS photos (or video frames) of one product, sent in a single call. */
  extract(input: {
    barcode: string;
    photoKeys: string[];
  }): Promise<ExtractionOutput>;
}
