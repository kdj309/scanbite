import { z } from "zod";
import {
  isoDateTimeSchema,
  objectIdSchema,
  severitySchema,
  summaryPeriodSchema,
} from "./primitives";
import { barcodeSchema } from "./products";

export const createScanRequestSchema = z.object({
  barcode: barcodeSchema,
  member_id: objectIdSchema.optional(),
});
export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;

export const scanSchema = z.object({
  id: objectIdSchema,
  barcode: barcodeSchema,
  member_id: objectIdSchema,
  product_version_id: objectIdSchema.nullable(),
  found: z.boolean(),
  created_at: isoDateTimeSchema,
});
export type Scan = z.infer<typeof scanSchema>;

export const createScanResponseSchema = scanSchema;
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

export const memberSummaryQuerySchema = z.object({
  period: summaryPeriodSchema,
});
export type MemberSummaryQuery = z.infer<typeof memberSummaryQuerySchema>;

export const memberSummaryResponseSchema = z.object({
  period: summaryPeriodSchema,
  scan_count: z.number().int().nonnegative(),
  total_sugar_g: z.number().nonnegative(),
  by_severity: z.object({
    green: z.number().int().nonnegative(),
    yellow: z.number().int().nonnegative(),
    red: z.number().int().nonnegative(),
  }),
});
export type MemberSummaryResponse = z.infer<typeof memberSummaryResponseSchema>;
