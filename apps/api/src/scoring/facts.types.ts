import type { ExtractionConfidence } from "./facts";

export type VersionConfidence = {
  unresolved_ingredients: string[];
  confidence: ExtractionConfidence;
};
