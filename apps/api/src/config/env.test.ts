import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateEnv } from "./env";

const REQUIRED_BASE = {
  MONGODB_URI: "mongodb://localhost/test",
  REDIS_URL: "redis://localhost",
  JWT_SECRET: "a-secret-at-least-16-chars",
  S3_ENDPOINT: "https://s3.example.com",
  S3_ACCESS_KEY: "key",
  S3_SECRET_KEY: "secret",
  S3_BUCKET: "bucket",
};

describe("validateEnv", () => {
  it("accepts VISION_PROVIDER=stub with no vision API keys set", () => {
    const env = validateEnv({ ...REQUIRED_BASE, VISION_PROVIDER: "stub" });
    assert.equal(env.VISION_PROVIDER, "stub");
  });

  it("accepts VISION_PROVIDER=tiered when both API keys are set", () => {
    const env = validateEnv({
      ...REQUIRED_BASE,
      VISION_PROVIDER: "tiered",
      OPENROUTER_API_KEY: "or-key",
      ANTHROPIC_API_KEY: "an-key",
    });
    assert.equal(env.VISION_PROVIDER, "tiered");
  });

  it("rejects VISION_PROVIDER=tiered with no API keys set", () => {
    assert.throws(() =>
      validateEnv({ ...REQUIRED_BASE, VISION_PROVIDER: "tiered" })
    );
  });

  it("rejects VISION_PROVIDER=tiered with only one of the two keys set", () => {
    assert.throws(() =>
      validateEnv({
        ...REQUIRED_BASE,
        VISION_PROVIDER: "tiered",
        OPENROUTER_API_KEY: "or-key",
      })
    );
    assert.throws(() =>
      validateEnv({
        ...REQUIRED_BASE,
        VISION_PROVIDER: "tiered",
        ANTHROPIC_API_KEY: "an-key",
      })
    );
  });

  it("defaults to short access tokens and long refresh tokens", () => {
    const env = validateEnv({ ...REQUIRED_BASE });
    assert.equal(env.JWT_EXPIRES_IN, "15m");
    assert.equal(env.REFRESH_TOKEN_TTL_DAYS, 180);
    assert.deepEqual(env.GOOGLE_CLIENT_IDS, []);
  });

  it("requires the Apple signing key and encryption key when Apple sign-in is on", () => {
    assert.throws(() =>
      validateEnv({ ...REQUIRED_BASE, APPLE_CLIENT_IDS: "in.scanbite.app" })
    );
    const env = validateEnv({
      ...REQUIRED_BASE,
      APPLE_CLIENT_IDS: "in.scanbite.app",
      APPLE_TEAM_ID: "TEAM",
      APPLE_KEY_ID: "KEY",
      APPLE_PRIVATE_KEY: "pem",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    });
    assert.deepEqual(env.APPLE_CLIENT_IDS, ["in.scanbite.app"]);
  });

  it("rejects an encryption key that isn't 32 bytes", () => {
    assert.throws(() =>
      validateEnv({ ...REQUIRED_BASE, TOKEN_ENCRYPTION_KEY: "c2hvcnQ=" })
    );
  });

  it("parses comma-separated client ids once, at startup", () => {
    const env = validateEnv({
      ...REQUIRED_BASE,
      GOOGLE_CLIENT_IDS: " web.apps , ios.apps ,, ",
    });
    assert.deepEqual(env.GOOGLE_CLIENT_IDS, ["web.apps", "ios.apps"]);
    assert.deepEqual(validateEnv({ ...REQUIRED_BASE }).APPLE_CLIENT_IDS, []);
  });

  it("decodes the encryption key and unescapes the Apple key once", () => {
    const env = validateEnv({
      ...REQUIRED_BASE,
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      APPLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END",
    });
    assert.equal(env.TOKEN_ENCRYPTION_KEY?.length, 32);
    assert.equal(
      env.APPLE_PRIVATE_KEY,
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END"
    );
  });
});
