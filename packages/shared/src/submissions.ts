import { z } from "zod";
import { objectIdSchema, submissionStatusSchema } from "./primitives";

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
