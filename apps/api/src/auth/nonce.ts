import { UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { JWTPayload } from "jose";

/**
 * Sign-in nonce contract with the app: it generates a random raw nonce,
 * gives SHA-256(raw) as hex to the Google/Apple SDK (which puts it in the
 * ID token's `nonce` claim), and sends the raw value to us.
 */
export function hashNonce(rawNonce: string): string {
  return createHash("sha256").update(rawNonce).digest("hex");
}

/**
 * The token must carry the hash of the nonce this request presents. A token
 * whose nonce is the raw value (or missing) is rejected: that would mean
 * anyone holding the token could also supply the nonce.
 */
export function assertNonceMatches(
  payload: JWTPayload,
  rawNonce: string
): void {
  if (payload.nonce !== hashNonce(rawNonce)) {
    throw new UnauthorizedException(
      "Sign-in token does not match this request"
    );
  }
}
