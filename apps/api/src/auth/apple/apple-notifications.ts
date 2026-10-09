import { BadRequestException } from "@nestjs/common";
import type { JWTPayload } from "jose";
import { z } from "zod";

/**
 * Apple's server-to-server notification events. `consent-revoked` (user
 * stopped using Sign in with Apple for our app) and `account-delete` (user
 * deleted their Apple Account) mean the account must go (or lose Apple).
 */
const appleEventSchema = z.object({
  type: z.enum([
    "email-disabled",
    "email-enabled",
    "consent-revoked",
    "account-delete",
  ]),
  sub: z.string().min(1),
});
export type AppleNotificationEvent = z.infer<typeof appleEventSchema>;

/** Apple sends `events` as a JSON string (sometimes already an object). */
const eventsClaimSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}, appleEventSchema);

export function parseAppleNotificationEvent(
  payload: JWTPayload
): AppleNotificationEvent {
  const parsed = eventsClaimSchema.safeParse(payload.events);
  if (!parsed.success) {
    throw new BadRequestException("Malformed Apple notification");
  }
  return parsed.data;
}

export function requiresAccountDeletion(
  event: AppleNotificationEvent
): boolean {
  return event.type === "consent-revoked" || event.type === "account-delete";
}
