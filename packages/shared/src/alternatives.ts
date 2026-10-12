import { z } from "zod";
import { objectIdSchema } from "./primitives";
import { productSummarySchema } from "./products";

/** Less of a number that flagged the scanned product — shown as a meter. */
export const lessImprovementSchema = z.object({
  kind: z.literal("less"),
  label: z.string(), // "70% less sugar"
  // Per 100 g or ml, in `unit`: this product, the scanned one, and the
  // strictest limit that flagged the scanned one.
  value: z.number(),
  original: z.number(),
  limit: z.number(),
  unit: z.enum(["g", "mg"]),
});

/** Free of something that flagged it — a chip: "No palm oil", "No peanuts". */
export const freeOfImprovementSchema = z.object({
  kind: z.literal("free_of"),
  label: z.string(),
});

/** One way an alternative beats the scanned product, on what flagged it. */
export const improvementSchema = z.discriminatedUnion("kind", [
  lessImprovementSchema,
  freeOfImprovementSchema,
]);
export type Improvement = z.infer<typeof improvementSchema>;

export const alternativeSchema = z.object({
  product: productSummarySchema,
  improvements: z.array(improvementSchema),
});
export type Alternative = z.infer<typeof alternativeSchema>;

export const alternativesResponseSchema = z.object({
  instead_of: productSummarySchema,
  // Who these are Safe for: everyone the scanned product isn't Safe for.
  for_member_ids: z.array(objectIdSchema),
  // Same category and form, Safe for every one of them, best first
  // (biggest improvement on what flagged the scanned product). Empty when
  // there's nothing better in our list yet.
  alternatives: z.array(alternativeSchema),
});
export type AlternativesResponse = z.infer<typeof alternativesResponseSchema>;
