import { z } from "zod";
import { confidenceSchema, objectIdSchema, severitySchema } from "./primitives";

export const barcodeSchema = z.string().min(1);

export const verdictReasonKindSchema = z.enum(["flag", "unchecked"]);
export type VerdictReasonKind = z.infer<typeof verdictReasonKindSchema>;

// `reasons` is ordered: flags first, worst severity first (on a tie the
// member's condition rule before a general one), then "unchecked" gaps.
// So reasons[0], when it is a flag, is the main reason for the verdict.
export const verdictReasonSchema = z.object({
  // "flag": the rule matched. "unchecked": the fact it needs was missing,
  // so we couldn't tell — never a pass.
  kind: verdictReasonKindSchema,
  // null for "unchecked".
  severity: severitySchema.nullable(),
  // Short chip text, e.g. "High sugar".
  label: z.string(),
  text: z.string(),
  // Lets a client fetch the explainer (GET /rule-explainers); null for a
  // reason with no identifiable source rule.
  rule_id: z.string().nullable(),
});
export type VerdictReason = z.infer<typeof verdictReasonSchema>;

export const verdictSchema = z.object({
  severity: severitySchema,
  reasons: z.array(verdictReasonSchema),
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
export type ProductNotFoundResponse = z.infer<
  typeof productNotFoundResponseSchema
>;

export const productFoundResponseSchema = z.object({
  found: z.literal(true),
  // True if the resolved member's conditions list is non-empty — tells the
  // client whether this is a genuinely personalized verdict or an
  // objective-only one with nothing to personalize against yet (HLD §10/§15).
  member_has_conditions: z.boolean(),
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

export const catalogQuerySchema = z.object({
  member_id: objectIdSchema.optional(),
  category: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  severity: severitySchema.optional(),
  q: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: objectIdSchema.optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const catalogItemSchema = z.object({
  product: productSummarySchema,
  verdict: verdictSchema,
  confidence: confidenceSchema,
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const catalogResponseSchema = z.object({
  member_has_conditions: z.boolean(),
  items: z.array(catalogItemSchema),
  next_cursor: objectIdSchema.nullable(),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
