import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import type { Env } from "../config/env";
import { assertNonceMatches } from "./nonce";
import type { SocialProvider } from "./social-sign-in";

export type VerifiedIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  /** The client id the token was issued for (needed for Apple's code exchange). */
  audience: string;
  /** Google Workspace domain (`hd`), when the account belongs to one. */
  hostedDomain: string | null;
};

/**
 * Port for checking JWTs signed by Google/Apple — users' ID tokens and
 * Apple's server-to-server notifications — so the auth flow and its tests
 * don't depend on the real providers.
 */
export abstract class IdTokenVerifier {
  abstract verify(
    provider: SocialProvider,
    idToken: string,
    rawNonce: string
  ): Promise<VerifiedIdentity>;

  /** Verifies an Apple server-to-server notification JWT; returns its claims. */
  abstract verifyAppleNotification(signedPayload: string): Promise<JWTPayload>;
}

const PROVIDERS = {
  google: {
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    audienceEnv: "GOOGLE_CLIENT_IDS",
  },
  apple: {
    jwksUrl: "https://appleid.apple.com/auth/keys",
    issuers: ["https://appleid.apple.com"],
    audienceEnv: "APPLE_CLIENT_IDS",
  },
} as const;

/**
 * Turns verified token claims into the fields we use. Apple sends
 * `email_verified` as the string "true"; Google sends a boolean.
 */
export function toVerifiedIdentity(payload: JWTPayload): VerifiedIdentity {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new UnauthorizedException("Sign-in token has no subject");
  }
  const email = typeof payload.email === "string" ? payload.email : null;
  const rawVerified = payload.email_verified;
  const emailVerified = rawVerified === true || rawVerified === "true";
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  const hostedDomain = typeof payload.hd === "string" ? payload.hd : null;
  return {
    sub: payload.sub,
    email,
    emailVerified,
    audience: aud ?? "",
    hostedDomain,
  };
}

/** Signature, issuer, audience and expiry; any failure becomes a 401. */
export async function verifySignedJwt(
  token: string,
  keys: JWTVerifyGetKey,
  options: { issuers: readonly string[]; audience: string[] },
  invalidMessage: string
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: [...options.issuers],
      audience: options.audience,
    });
    return payload;
  } catch {
    throw new UnauthorizedException(invalidMessage);
  }
}

/** A user's ID token: signed-JWT checks, then the nonce, then the identity. */
export async function verifyIdToken(
  idToken: string,
  keys: JWTVerifyGetKey,
  options: { issuers: readonly string[]; audience: string[]; rawNonce: string }
): Promise<VerifiedIdentity> {
  const payload = await verifySignedJwt(
    idToken,
    keys,
    options,
    "Invalid sign-in token"
  );
  assertNonceMatches(payload, options.rawNonce);
  return toVerifiedIdentity(payload);
}

/**
 * Uses the providers' published signing keys (fetched once and cached by
 * jose). Adding a provider = a PROVIDERS entry plus its key set below.
 */
@Injectable()
export class JoseIdTokenVerifier extends IdTokenVerifier {
  // Typed by SocialProvider, so adding a provider without its key set is a
  // compile error rather than a runtime surprise.
  private readonly keySets: Record<SocialProvider, JWTVerifyGetKey> = {
    google: createRemoteJWKSet(new URL(PROVIDERS.google.jwksUrl)),
    apple: createRemoteJWKSet(new URL(PROVIDERS.apple.jwksUrl)),
  };

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  verify(
    provider: SocialProvider,
    idToken: string,
    rawNonce: string
  ): Promise<VerifiedIdentity> {
    return verifyIdToken(idToken, this.keySets[provider], {
      issuers: PROVIDERS[provider].issuers,
      audience: this.audienceFor(provider),
      rawNonce,
    });
  }

  verifyAppleNotification(signedPayload: string): Promise<JWTPayload> {
    return verifySignedJwt(
      signedPayload,
      this.keySets.apple,
      { issuers: PROVIDERS.apple.issuers, audience: this.audienceFor("apple") },
      "Invalid Apple notification"
    );
  }

  /** Our client ids for the provider; none configured = sign-in disabled. */
  private audienceFor(provider: SocialProvider): string[] {
    const audience = this.config.get(PROVIDERS[provider].audienceEnv, {
      infer: true,
    });
    if (audience.length === 0) {
      throw new ServiceUnavailableException(
        `${provider} sign-in is not configured`
      );
    }
    return audience;
  }
}
