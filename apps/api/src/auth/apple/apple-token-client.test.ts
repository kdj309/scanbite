import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAppleTokenClient } from "./apple-token-client";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const config = new ConfigService({
  APPLE_TEAM_ID: "TEAM123",
  APPLE_KEY_ID: "KEY123",
  APPLE_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }),
});
const client = new HttpAppleTokenClient(config as never);

const realFetch = globalThis.fetch;
let sent: { url: string; form: URLSearchParams } | null = null;

function stubFetch(status: number, body: unknown): void {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, form: new URLSearchParams(init.body as URLSearchParams) };
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe("HttpAppleTokenClient", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
    sent = null;
  });

  it("exchanges the code with a signed client secret", async () => {
    stubFetch(200, { refresh_token: "apple-rt" });
    assert.equal(
      await client.exchangeCode("one-time-code", "in.scanbite.app"),
      "apple-rt"
    );
    assert.equal(sent?.url, "https://appleid.apple.com/auth/token");
    assert.equal(sent?.form.get("code"), "one-time-code");
    assert.equal(sent?.form.get("grant_type"), "authorization_code");
    assert.equal(sent?.form.get("client_id"), "in.scanbite.app");
    assert.equal(sent?.form.get("client_secret")?.split(".").length, 3);
  });

  it("turns a rejected code into a 401 without echoing Apple's body", async () => {
    stubFetch(400, { error: "invalid_grant", secret_detail: "leak" });
    await assert.rejects(
      client.exchangeCode("used-code", "in.scanbite.app"),
      (err: unknown) =>
        err instanceof UnauthorizedException &&
        !JSON.stringify(err.getResponse()).includes("leak")
    );
  });

  it("revokes the refresh token", async () => {
    stubFetch(200, {});
    await client.revoke("apple-rt", "in.scanbite.app");
    assert.equal(sent?.url, "https://appleid.apple.com/auth/revoke");
    assert.equal(sent?.form.get("token"), "apple-rt");
    assert.equal(sent?.form.get("token_type_hint"), "refresh_token");
  });

  it("fails loudly when revocation is refused", async () => {
    stubFetch(500, {});
    await assert.rejects(client.revoke("apple-rt", "in.scanbite.app"));
  });
});
