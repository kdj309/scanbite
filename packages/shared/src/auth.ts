import { z } from "zod";
import { householdMemberSchema } from "./household";
import {
  authProviderSchema,
  isoDateTimeSchema,
  objectIdSchema,
} from "./primitives";

export const userSchema = z.object({
  id: objectIdSchema,
  // Absent for anonymous accounts until they link Google/Apple.
  email: z.string().email().optional(),
  auth_provider: authProviderSchema,
  default_member_id: objectIdSchema,
  created_at: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

// POST /auth/google and /auth/apple. The ID token comes from the native
// sign-in SDK on the phone. If the request carries a valid access token,
// the identity is linked to that (usually anonymous) account.
//
// nonce: the app generates a random value per sign-in, passes
// SHA-256(nonce) as hex to the Google/Apple SDK (it ends up inside the ID
// token), and sends the RAW value here. A stolen ID token alone can't be
// replayed because the raw value can't be derived from its hash, and the
// server accepts each nonce only once.
export const socialSignInRequestSchema = z.object({
  id_token: z.string().min(1),
  nonce: z.string().min(16).max(256),
});
export type SocialSignInRequest = z.infer<typeof socialSignInRequestSchema>;

// Apple additionally sends the one-time authorization code (validated at
// Apple's /auth/token so we can store a refresh token and revoke it when the
// account is deleted — Apple TN3194), and the user's first name, which Apple
// only ever provides on the very first authorization (names the Self member).
export const appleSignInRequestSchema = socialSignInRequestSchema.extend({
  authorization_code: z.string().min(1),
  given_name: z.string().trim().max(100).optional(),
});
export type AppleSignInRequest = z.infer<typeof appleSignInRequestSchema>;

// Apple server-to-server notification: a JWT signed by Apple.
export const appleNotificationRequestSchema = z.object({
  payload: z.string().min(1),
});
export type AppleNotificationRequest = z.infer<
  typeof appleNotificationRequestSchema
>;

export const refreshTokenRequestSchema = z.object({
  refresh_token: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const authTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  // Seconds until access_token expires; refresh before then.
  expires_in: z.number().int().positive(),
  // Single-use: every /auth/refresh returns a new one and retires the old.
  refresh_token: z.string().min(1),
  user: userSchema,
  // True when a Google/Apple sign-in moved the caller onto a different,
  // already-existing account (e.g. after a reinstall). The client should
  // reload household/scans instead of assuming its local state still applies.
  account_switched: z.boolean(),
});
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;

export const meResponseSchema = z.object({
  user: userSchema,
  household_members: z.array(householdMemberSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
