import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
} from "jose";
import { toVerifiedIdentity, verifyIdToken } from "./id-token-verifier";
import { hashNonce } from "./nonce";

const ISSUER = "https://accounts.google.com";
const AUD = "android-client.apps.googleusercontent.com";

let privateKey: CryptoKey;
let keys: JWTVerifyGetKey;
let otherPrivateKey: CryptoKey;

async function sign(
  claims: Record<string, unknown>,
  opts: { iss?: string; aud?: string; exp?: string; key?: CryptoKey } = {}
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? privateKey);
}

const RAW_NONCE = "a-random-per-sign-in-value-123456";
const NONCE = hashNonce(RAW_NONCE);

const verify = (token: string, rawNonce = RAW_NONCE) =>
  verifyIdToken(token, keys, { issuers: [ISSUER], audience: [AUD], rawNonce });

describe("verifyIdToken", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const jwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: "k1",
      alg: "RS256",
    };
    keys = createLocalJWKSet({ keys: [jwk] });
    otherPrivateKey = (await generateKeyPair("RS256")).privateKey;
  });

  it("accepts a valid token and returns sub + verified email", async () => {
    const token = await sign({
      sub: "g-123",
      email: "Asha@Example.com",
      email_verified: true,
      nonce: NONCE,
    });
    assert.deepEqual(await verify(token), {
      sub: "g-123",
      email: "Asha@Example.com",
      emailVerified: true,
      audience: AUD,
      hostedDomain: null,
    });
  });

  it("rejects a token signed by a different key", async () => {
    const token = await sign(
      { sub: "g-1", nonce: NONCE },
      { key: otherPrivateKey }
    );
    await assert.rejects(verify(token), UnauthorizedException);
  });

  it("rejects a token issued for another app (audience)", async () => {
    const token = await sign(
      { sub: "g-1", nonce: NONCE },
      { aud: "someone-else" }
    );
    await assert.rejects(verify(token), UnauthorizedException);
  });

  it("rejects a token from another issuer", async () => {
    const token = await sign(
      { sub: "g-1", nonce: NONCE },
      { iss: "https://evil.example" }
    );
    await assert.rejects(verify(token), UnauthorizedException);
  });

  it("rejects an expired token", async () => {
    const token = await sign({ sub: "g-1", nonce: NONCE }, { exp: "-1m" });
    await assert.rejects(verify(token), UnauthorizedException);
  });

  it("rejects a token whose nonce doesn't match this request", async () => {
    const token = await sign({ sub: "g-1", nonce: NONCE });
    await assert.rejects(
      verify(token, "a-different-raw-nonce-value-999"),
      UnauthorizedException
    );
  });

  it("rejects a token with no nonce", async () => {
    const token = await sign({ sub: "g-1" });
    await assert.rejects(verify(token), UnauthorizedException);
  });

  it("rejects a token that carries the raw nonce instead of its hash", async () => {
    // If the raw value sat inside the token, whoever stole the token could
    // also present it — so this must not pass.
    const token = await sign({ sub: "g-1", nonce: RAW_NONCE });
    await assert.rejects(verify(token), UnauthorizedException);
  });
});

describe("toVerifiedIdentity", () => {
  it('treats Apple\'s string "true" as verified', () => {
    const id = toVerifiedIdentity({
      sub: "a-1",
      email: "x@privaterelay.appleid.com",
      email_verified: "true",
    });
    assert.equal(id.emailVerified, true);
  });

  it("does not treat a missing or false flag as verified", () => {
    assert.equal(toVerifiedIdentity({ sub: "a" }).emailVerified, false);
    assert.equal(
      toVerifiedIdentity({ sub: "a", email_verified: "false" }).emailVerified,
      false
    );
  });

  it("rejects a token without a subject", () => {
    assert.throws(() => toVerifiedIdentity({}), UnauthorizedException);
  });
});
