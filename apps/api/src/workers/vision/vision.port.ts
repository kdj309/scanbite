import type { ExtractionOutput } from "./extraction-output";

export const VISION_PORT = "VISION_PORT";

export interface VisionPort {
  extract(input: {
    barcode: string;
    photoKey: string;
  }): Promise<ExtractionOutput>;
}
