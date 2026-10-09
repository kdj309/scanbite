import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { decryptSecret, encryptSecret } from "./secret-box";

const KEY = randomBytes(32);

describe("secret-box", () => {
  it("round-trips a secret", () => {
    const sealed = encryptSecret("apple-refresh-token", KEY);
    assert.notEqual(sealed, "apple-refresh-token");
    assert.equal(decryptSecret(sealed, KEY), "apple-refresh-token");
  });

  it("uses a fresh IV each time (same input, different output)", () => {
    assert.notEqual(encryptSecret("x", KEY), encryptSecret("x", KEY));
  });

  it("rejects a tampered value instead of returning garbage", () => {
    const sealed = Buffer.from(encryptSecret("secret", KEY), "base64url");
    sealed[sealed.length - 1] ^= 0xff;
    assert.throws(() => decryptSecret(sealed.toString("base64url"), KEY));
  });

  it("rejects the wrong key", () => {
    const sealed = encryptSecret("secret", KEY);
    assert.throws(() => decryptSecret(sealed, randomBytes(32)));
  });
});
