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

// "anonymous" = created silently on first app open (no identity yet); a
// Google/Apple sign-in later links that identity to the same account.
export const authProviderSchema = z.enum(["anonymous", "google", "apple"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const submissionStatusSchema = z.enum([
  "processing",
  "ready",
  "needs_review",
  "failed",
]);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const objectIdSchema = z.string().min(1);

/** An array of `item` with no repeats (e.g. a member's conditions). */
export function uniqueListOf<T extends z.ZodTypeAny>(item: T, message: string) {
  return z.array(item).superRefine((values, ctx) => {
    const seen = new Set<unknown>();
    for (const [index, value] of values.entries()) {
      if (seen.has(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [index] });
      }
      seen.add(value);
    }
  });
}
