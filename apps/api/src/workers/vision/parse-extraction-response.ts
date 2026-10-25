import { Logger } from "@nestjs/common";
import {
  extractionOutputSchema,
  unlistedNutritionKeys,
  type ExtractionOutput,
} from "./extraction-output";

const logger = new Logger("ExtractionResponse");

/** Models sometimes wrap JSON in a markdown fence despite being told not to — same tolerance as the eval harness. */
export function parseExtractionResponse(text: string): ExtractionOutput {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const json: unknown = JSON.parse(raw);
  const unlisted = unlistedNutritionKeys(
    (json as { nutrition?: unknown } | null)?.nutrition
  );
  if (unlisted.length > 0) {
    logger.warn(
      `Dropped nutrition keys the rules don't read: ${unlisted.join(", ")}`
    );
  }
  return extractionOutputSchema.parse(json);
}
