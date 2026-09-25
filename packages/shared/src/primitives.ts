import { z } from "zod";

export const severitySchema = z.enum(["green", "yellow", "red"]);
export type Severity = z.infer<typeof severitySchema>;

export const confidenceSchema = z.enum(["full", "partial", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const relationshipSchema = z.enum([
  "self",
  "spouse",
  "child",
  "parent",
  "other",
]);
export type Relationship = z.infer<typeof relationshipSchema>;

export const authProviderSchema = z.enum(["otp", "password"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const submissionStatusSchema = z.enum([
  "processing",
  "ready",
  "needs_review",
  "failed",
]);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const summaryPeriodSchema = z.enum(["week", "month"]);
export type SummaryPeriod = z.infer<typeof summaryPeriodSchema>;

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const objectIdSchema = z.string().min(1);
