import type { UserRole } from "../database/schemas/user.schema";
import type { VerifiedIdentity } from "./id-token-verifier";

export type JwtPayload = {
  sub: string;
  role: UserRole;
};

export type RequestUser = {
  userId: string;
  role: UserRole;
  defaultMemberId: string | null;
};

export type DeleteAccountOptions = { revokeApple?: boolean };

export type SignedJwtOptions = {
  issuers: readonly string[];
  audience: string[];
};

export type IdTokenOptions = SignedJwtOptions & { rawNonce: string };

/** What decides whether a sign-in's email can be trusted to link accounts. */
export type LinkingIdentity = Pick<
  VerifiedIdentity,
  "email" | "emailVerified" | "hostedDomain"
>;

/** An HTTP request after JwtAuthGuard has put the user on it. */
export type AuthenticatedRequest = { user: RequestUser };

/** An HTTP request seen before authentication: only its headers. */
export type RequestWithHeaders = {
  headers: Record<string, string | undefined>;
};

/** An access token's expiry and issue times, in seconds since the epoch. */
export type TokenTimes = { exp: number; iat: number };

/** The part of Apple's /auth/token response we keep. */
export type AppleTokenResponse = { refresh_token?: string };
