import { z } from "zod";

export const extractionOutputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  ingredients: z.array(z.string()),
  nutrition: z.record(z.union([z.number(), z.string(), z.null()])),
  nova_group: z.number().optional(),
  additive_count: z.number().optional(),
  extraction_confidence: z.number().min(0).max(1),
  /**
   * Whether the supplied photos all appear to be the same product's
   * packaging. "inconsistent" forces needs_review regardless of
   * extraction_confidence — a confidently-extracted merge of two different
   * products is worse than an honest low-confidence read of one.
   */
  photo_consistency: z.enum(["consistent", "inconsistent"]),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
