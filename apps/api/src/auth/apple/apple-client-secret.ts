import { SignJWT, importPKCS8 } from "jose";

export type AppleSigningKey = {
  teamId: string;
  keyId: string;
  /** Contents of the .p8 file (PEM). */
  privateKey: string;
};

/**
 * Apple's /auth/token and /auth/revoke take a "client secret" that is an
 * ES256 JWT we sign with our Sign in with Apple key: iss = team id,
 * sub = the client id the code/token belongs to, aud = appleid.apple.com.
 * Apple allows up to 6 months; we mint a short-lived one per call instead
 * of caching a long-lived credential.
 */
export async function buildAppleClientSecret(
  key: AppleSigningKey,
  clientId: string,
  now: Date = new Date()
): Promise<string> {
  const signingKey = await importPKCS8(key.privateKey, "ES256");
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: key.keyId })
    .setIssuer(key.teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(iat)
    .setExpirationTime(iat + 5 * 60)
    .sign(signingKey);
}
