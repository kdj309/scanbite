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
