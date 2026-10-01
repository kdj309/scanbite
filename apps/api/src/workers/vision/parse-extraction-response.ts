import {
  extractionOutputSchema,
  type ExtractionOutput,
} from "./extraction-output";

/** Models sometimes wrap JSON in a markdown fence despite being told not to — same tolerance as the eval harness. */
export function parseExtractionResponse(text: string): ExtractionOutput {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  return extractionOutputSchema.parse(JSON.parse(raw));
}
