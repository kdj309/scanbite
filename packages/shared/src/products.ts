import { z } from "zod";
import { confidenceSchema, objectIdSchema, severitySchema } from "./primitives";

export const barcodeSchema = z.string().min(1);

export const verdictSchema = z.object({
  severity: severitySchema,
  reasons: z.array(z.string()),
});
export type Verdict = z.infer<typeof verdictSchema>;

export const productSummarySchema = z.object({
  name: z.string(),
  brand: z.string(),
  product_version_id: objectIdSchema,
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productNotFoundResponseSchema = z.object({
  found: z.literal(false),
});
export type ProductNotFoundResponse = z.infer<typeof productNotFoundResponseSchema>;

export const productFoundResponseSchema = z.object({
  found: z.literal(true),
  product: productSummarySchema,
  verdict: verdictSchema,
  confidence: confidenceSchema,
  unresolved_ingredients: z.array(z.string()),
});
export type ProductFoundResponse = z.infer<typeof productFoundResponseSchema>;

export const productLookupResponseSchema = z.discriminatedUnion("found", [
  productNotFoundResponseSchema,
  productFoundResponseSchema,
]);
export type ProductLookupResponse = z.infer<typeof productLookupResponseSchema>;

export const productLookupQuerySchema = z.object({
  member_id: objectIdSchema.optional(),
});
export type ProductLookupQuery = z.infer<typeof productLookupQuerySchema>;
