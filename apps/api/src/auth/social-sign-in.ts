import type { AuthProvider } from "@foodscanner/shared";

/** Providers you can sign in with — every auth provider except "anonymous". */
export type SocialProvider = Exclude<AuthProvider, "anonymous">;

const GOOGLE_CONSUMER_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Whether a provider-verified email is trustworthy enough to attach this
 * sign-in to a DIFFERENT existing account that uses the same email.
 *
 * Google is only authoritative for Gmail addresses and Workspace accounts
 * (`hd` set): for any other address, "verified" only means it was verified
 * when the Google account was created, and the address may since belong to
 * someone else. Apple emails are never used for linking — real addresses
 * have the same weakness and relay addresses are unique per app anyway.
 * Identity itself is always the provider's `sub`, never the email.
 */
export function isEmailTrustedForLinking(
  provider: SocialProvider,
  identity: {
    email: string | null;
    emailVerified: boolean;
    hostedDomain: string | null;
  }
): boolean {
  if (provider !== "google" || !identity.email || !identity.emailVerified) {
    return false;
  }
  if (identity.hostedDomain) {
    return true;
  }
  const domain = identity.email.split("@")[1]?.toLowerCase() ?? "";
  return GOOGLE_CONSUMER_DOMAINS.has(domain);
}

export type SignInCandidate = {
  id: string;
  /** The sub already stored for the provider being signed in with, if any. */
  provider_sub: string | null;
};

// Every rule below runs only after rule 1 found no account with this exact
// identity, so any `provider_sub` seen there is a DIFFERENT identity.

export type SocialSignInInput = {
  /** The account the request's access token belongs to, if one was sent. */
  current: SignInCandidate | null;
  /** The account already linked to this exact Google/Apple identity. */
  bySub: { id: string } | null;
  /** An account that owns this identity's TRUSTED (Gmail/Workspace) email. */
  byVerifiedEmail: SignInCandidate | null;
};

export type SocialSignInDecision =
  | { kind: "use-existing"; userId: string; switched: boolean }
  | { kind: "link-current"; userId: string }
  | { kind: "create" }
  | { kind: "conflict"; reason: string };

/**
 * Decides which account a verified Google/Apple identity signs into.
 * Order matters:
 *  1. The identity is already linked somewhere -> that account wins. If the
 *     caller was on a different (e.g. fresh anonymous) account, they are
 *     switched — this is the reinstall case.
 *  2. An account already owns this identity's trusted email (Gmail or
 *     Workspace, see isEmailTrustedForLinking) -> attach the identity there
 *     instead of creating a duplicate person.
 *  3. The caller has an account that isn't linked to a different identity
 *     of this provider -> link it (the normal anonymous -> Google upgrade).
 *  4. Otherwise create a new account.
 */
export function decideSocialSignIn(
  input: SocialSignInInput
): SocialSignInDecision {
  const { current, bySub, byVerifiedEmail } = input;

  if (bySub) {
    return {
      kind: "use-existing",
      userId: bySub.id,
      switched: current !== null && current.id !== bySub.id,
    };
  }

  if (byVerifiedEmail && byVerifiedEmail.id !== current?.id) {
    if (byVerifiedEmail.provider_sub) {
      return {
        kind: "conflict",
        reason: "That email already belongs to a different sign-in",
      };
    }
    return {
      kind: "use-existing",
      userId: byVerifiedEmail.id,
      switched: current !== null,
    };
  }

  if (current) {
    if (current.provider_sub) {
      return {
        kind: "conflict",
        reason: "This account is already linked to a different sign-in",
      };
    }
    return { kind: "link-current", userId: current.id };
  }

  return { kind: "create" };
}
