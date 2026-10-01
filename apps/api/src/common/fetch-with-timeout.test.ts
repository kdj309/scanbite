import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchWithTimeout } from "./fetch-with-timeout";

describe("fetchWithTimeout", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("passes the url and init through to fetch, adding a signal", async () => {
    let capturedInit: RequestInit | undefined;
    global.fetch = (async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return new Response("ok");
    }) as typeof fetch;

    await fetchWithTimeout("https://example.com", {
      method: "POST",
      headers: { "x-test": "1" },
    });

    assert.equal(capturedInit?.method, "POST");
    assert.equal(
      (capturedInit?.headers as Record<string, string>)["x-test"],
      "1"
    );
    assert.ok(capturedInit?.signal instanceof AbortSignal);
  });

  it("aborts the request once the timeout elapses", async () => {
    global.fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
      })) as typeof fetch;

    await assert.rejects(
      () => fetchWithTimeout("https://example.com", { timeoutMs: 20 }),
      /aborted/
    );
  });
});
