import { z } from "zod";
import {
  isoDateTimeSchema,
  objectIdSchema,
  severitySchema,
} from "./primitives";
import {
  barcodeSchema,
  productLookupResponseSchema,
  productSummarySchema,
} from "./products";

export const createScanRequestSchema = z.object({
  barcode: barcodeSchema,
  // Who it was scanned for ("Scan for Papa"); omitted = everyone.
  member_id: objectIdSchema.optional(),
});
export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;

export const scanMemberVerdictSchema = z.object({
  member_id: objectIdSchema,
  severity: severitySchema,
});

// A scan records what was shown at that moment and never changes; open the
// product (GET /products/:barcode) for today's verdicts.
export const scanSchema = z.object({
  id: objectIdSchema,
  barcode: barcodeSchema,
  // Who it was scanned for; null = everyone.
  member_id: objectIdSchema.nullable(),
  product_version_id: objectIdSchema.nullable(),
  // null when the product wasn't found.
  product: productSummarySchema.nullable(),
  found: z.boolean(),
  // That member's verdict, or the household's overall one for "everyone".
  severity: severitySchema.nullable(),
  // Every member's verdict at scan time (Home: "Avoid for Papa · ...").
  verdicts: z.array(scanMemberVerdictSchema),
  rule_set_version: z.string().nullable(),
  created_at: isoDateTimeSchema,
});
export type Scan = z.infer<typeof scanSchema>;

// What the scanner shows (same body as GET /products/:barcode) plus the id
// of the history entry it created.
export const createScanResponseSchema = z.object({
  scan_id: objectIdSchema,
  result: productLookupResponseSchema,
});
export type CreateScanResponse = z.infer<typeof createScanResponseSchema>;

export const listScansQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
});
export type ListScansQuery = z.infer<typeof listScansQuerySchema>;

export const listScansResponseSchema = z.object({
  items: z.array(scanSchema),
  next_cursor: z.string().nullable(),
});
export type ListScansResponse = z.infer<typeof listScansResponseSchema>;
