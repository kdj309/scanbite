import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import type { ObjectStorageService } from "../../common/object-storage.service";
import { ClaudeVisionAdapter } from "./claude-vision.adapter";

function fakeConfig(values: Partial<Env>): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

function fakeStorage(): ObjectStorageService {
  return {
    getLabelPhoto: async () => Buffer.from("fake-image-bytes"),
  } as unknown as ObjectStorageService;
}

const VALID_EXTRACTION = {
  name: "Parle-G",
  brand: "Parle",
  category: "Biscuits",
  ingredients: ["Sugar"],
  nutrition: {},
  extraction_confidence: 0.3,
  photo_consistency: "consistent",
};

describe("ClaudeVisionAdapter", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws without calling fetch when ANTHROPIC_API_KEY is missing", async () => {
    let called = false;
    global.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;

    const adapter = new ClaudeVisionAdapter(fakeConfig({}), fakeStorage());
    await assert.rejects(
      () => adapter.extract({ barcode: "1", photoKeys: ["labels/1/a.jpg"] }),
      /ANTHROPIC_API_KEY/
    );
    assert.equal(called, false);
  });

  it("sends photos as base64 image blocks with the anthropic headers", async () => {
    let capturedUrl: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;
    let capturedBody: { messages: Array<{ content: unknown[] }> } | undefined;
    global.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = init?.headers as Record<string, string>;
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(VALID_EXTRACTION) }],
        })
      );
    }) as unknown as typeof fetch;

    const adapter = new ClaudeVisionAdapter(
      fakeConfig({ ANTHROPIC_API_KEY: "test-key" }),
      fakeStorage()
    );
    const result = await adapter.extract({
      barcode: "1",
      photoKeys: ["labels/1/a.jpg"],
    });

    assert.equal(result.name, "Parle-G");
    assert.equal(capturedUrl, "https://api.anthropic.com/v1/messages");
    assert.equal(capturedHeaders?.["x-api-key"], "test-key");
    assert.equal(capturedHeaders?.["anthropic-version"], "2023-06-01");
    const content = capturedBody?.messages[0].content as Array<
      Record<string, unknown>
    >;
    assert.equal(content[1].type, "image");
    const source = content[1].source as {
      type: string;
      media_type: string;
      data: string;
    };
    assert.equal(source.type, "base64");
    assert.equal(source.media_type, "image/jpeg");
  });

  it("picks the text block when the response contains multiple content blocks", async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          content: [
            { type: "thinking", text: "ignored" },
            { type: "text", text: JSON.stringify(VALID_EXTRACTION) },
          ],
        })
      )) as unknown as typeof fetch;

    const adapter = new ClaudeVisionAdapter(
      fakeConfig({ ANTHROPIC_API_KEY: "test-key" }),
      fakeStorage()
    );
    const result = await adapter.extract({
      barcode: "1",
      photoKeys: ["labels/1/a.jpg"],
    });
    assert.equal(result.name, "Parle-G");
  });

  it("throws with the HTTP status and body on a non-ok response", async () => {
    global.fetch = (async () =>
      new Response("overloaded", { status: 529 })) as unknown as typeof fetch;

    const adapter = new ClaudeVisionAdapter(
      fakeConfig({ ANTHROPIC_API_KEY: "test-key" }),
      fakeStorage()
    );
    await assert.rejects(
      () => adapter.extract({ barcode: "1", photoKeys: ["labels/1/a.jpg"] }),
      /HTTP 529/
    );
  });
});
