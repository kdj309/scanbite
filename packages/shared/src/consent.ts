import { z } from "zod";
import { isoDateTimeSchema } from "./primitives";

/**
 * The health-info notice people agree to (design 0b). Bump it when the
 * notice or privacy policy changes in a way that needs agreeing again:
 * consent to an older version doesn't count.
 */
export const HEALTH_CONSENT_NOTICE_VERSION = "2026-11-19";

/** When someone agreed to the health-info notice, and which version. */
export const healthConsentSchema = z.object({
  notice_version: z.string().min(1),
  agreed_at: isoDateTimeSchema,
});
export type HealthConsent = z.infer<typeof healthConsentSchema>;

/** POST /me/health-consent: "I agree" on the current notice. */
export const recordHealthConsentRequestSchema = z.object({
  notice_version: z.literal(HEALTH_CONSENT_NOTICE_VERSION),
});
export type RecordHealthConsentRequest = z.infer<
  typeof recordHealthConsentRequestSchema
>;

/**
 * Why we may hold a family member's details (design 8c): "guardian" for a
 * child ("I'm their parent or guardian"), "member_agreed" for an adult
 * ("they've agreed to me adding their health info").
 */
export const memberConsentBasisSchema = z.enum(["guardian", "member_agreed"]);
export type MemberConsentBasis = z.infer<typeof memberConsentBasisSchema>;
