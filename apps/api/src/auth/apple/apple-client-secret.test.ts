import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeProtectedHeader,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "jose";
import { buildAppleClientSecret } from "./apple-client-secret";

describe("buildAppleClientSecret", () => {
  it("signs an ES256 JWT with the claims Apple requires", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const pem = await exportPKCS8(privateKey);
    const now = new Date("2026-10-08T10:00:00Z");
    const secret = await buildAppleClientSecret(
      { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem },
      "in.scanbite.app",
      now
    );

    assert.deepEqual(decodeProtectedHeader(secret), {
      alg: "ES256",
      kid: "KEY1234567",
    });
    const { payload } = await jwtVerify(secret, publicKey, {
      issuer: "TEAM123456",
      audience: "https://appleid.apple.com",
      subject: "in.scanbite.app",
      currentDate: now,
    });
    assert.equal(payload.exp! - payload.iat!, 300);
  });
});
