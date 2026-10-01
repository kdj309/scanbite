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
});
