import { z } from "zod";
import { objectIdSchema, submissionStatusSchema } from "./primitives";
import { productFoundResponseSchema } from "./products";

export const createSubmissionResponseSchema = z.object({
  submission_id: objectIdSchema,
});
export type CreateSubmissionResponse = z.infer<
  typeof createSubmissionResponseSchema
>;

export const submissionStatusResponseSchema = z.object({
  status: submissionStatusSchema,
  product_version_id: objectIdSchema.optional(),
});
export type SubmissionStatusResponse = z.infer<
  typeof submissionStatusResponseSchema
>;

// POST /label-checks?member_id=…: who it's checked for ("Scan for Papa");
// omitted = everyone. Its Recent scans entry is recorded for them once read.
export const createLabelCheckQuerySchema = z.object({
  member_id: objectIdSchema.optional(),
});
export type CreateLabelCheckQuery = z.infer<typeof createLabelCheckQuerySchema>;

// A label check's verdict (GET /label-checks/:id): the same body as a found
// product, with product.source "label_check".
export const labelCheckResponseSchema = productFoundResponseSchema;
export type LabelCheckResponse = z.infer<typeof labelCheckResponseSchema>;
