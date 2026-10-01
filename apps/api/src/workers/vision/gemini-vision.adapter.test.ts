import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import type { ObjectStorageService } from "../../common/object-storage.service";
import { GeminiVisionAdapter } from "./gemini-vision.adapter";

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
  extraction_confidence: 0.9,
  photo_consistency: "consistent",
};

describe("GeminiVisionAdapter", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws without calling fetch when OPENROUTER_API_KEY is missing", async () => {
    let called = false;
    global.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;

    const adapter = new GeminiVisionAdapter(fakeConfig({}), fakeStorage());
    await assert.rejects(
      () => adapter.extract({ barcode: "1", photoKeys: ["labels/1/a.jpg"] }),
      /OPENROUTER_API_KEY/
    );
    assert.equal(called, false);
  });

  it("sends photos as image_url data URIs and parses a valid response", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: { messages: Array<{ content: unknown[] }> } | undefined;
    global.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(VALID_EXTRACTION) } }],
        })
      );
    }) as unknown as typeof fetch;

    const adapter = new GeminiVisionAdapter(
      fakeConfig({
        OPENROUTER_API_KEY: "test-key",
        GEMINI_OPENROUTER_MODEL: "google/gemini-2.5-flash",
      }),
      fakeStorage()
    );
    const result = await adapter.extract({
      barcode: "1",
      photoKeys: ["labels/1/a.jpg", "labels/1/b.jpg"],
    });

    assert.equal(result.name, "Parle-G");
    assert.equal(capturedUrl, "https://openrouter.ai/api/v1/chat/completions");
    const content = capturedBody?.messages[0].content as Array<
      Record<string, unknown>
    >;
    assert.equal(content.length, 3); // 1 text block + 2 photos
    assert.equal(content[0].type, "text");
    assert.equal(content[1].type, "image_url");
    assert.ok(
      (content[1].image_url as { url: string }).url.startsWith(
        "data:image/jpeg;base64,"
      )
    );
  });

  it("throws with the HTTP status and body on a non-ok response", async () => {
    global.fetch = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;

    const adapter = new GeminiVisionAdapter(
      fakeConfig({
        OPENROUTER_API_KEY: "test-key",
        GEMINI_OPENROUTER_MODEL: "m",
      }),
      fakeStorage()
    );
    await assert.rejects(
      () => adapter.extract({ barcode: "1", photoKeys: ["labels/1/a.jpg"] }),
      /HTTP 429/
    );
  });

  it("throws when the model's reply isn't valid extraction JSON", async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "not json" } }] })
      )) as unknown as typeof fetch;

    const adapter = new GeminiVisionAdapter(
      fakeConfig({
        OPENROUTER_API_KEY: "test-key",
        GEMINI_OPENROUTER_MODEL: "m",
      }),
      fakeStorage()
    );
    await assert.rejects(() =>
      adapter.extract({ barcode: "1", photoKeys: ["labels/1/a.jpg"] })
    );
  });
});
