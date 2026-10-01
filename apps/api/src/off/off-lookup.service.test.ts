import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { RedisCacheService } from "../common/redis-cache.service";
import { OffLookupService } from "./off-lookup.service";

function fakeCache(): RedisCacheService & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    getJson: async (key: string) => store.get(key),
    setJson: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  } as unknown as RedisCacheService & { store: Map<string, unknown> };
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("OffLookupService", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns and caches a found product", async () => {
    global.fetch = (async () =>
      jsonResponse({
        status: 1,
        product: {
          product_name: "Parle-G",
          ingredients_text: "Sugar, Wheat Flour",
        },
      })) as unknown as typeof fetch;

    const cache = fakeCache();
    const service = new OffLookupService(cache);
    const result = await service.lookup("123");

    assert.equal(result?.name, "Parle-G");
    assert.equal(
      (cache.store.get("off:product:123") as { found: boolean }).found,
      true
    );
  });

  it("caches a genuine not-found (status: 0) as negative", async () => {
    global.fetch = (async () =>
      jsonResponse({ status: 0 })) as unknown as typeof fetch;

    const cache = fakeCache();
    const service = new OffLookupService(cache);
    const result = await service.lookup("456");

    assert.equal(result, null);
    assert.deepEqual(cache.store.get("off:product:456"), { found: false });
  });

  it("does NOT cache a transient HTTP failure", async () => {
    global.fetch = (async () =>
      jsonResponse({}, false, 503)) as unknown as typeof fetch;

    const cache = fakeCache();
    const service = new OffLookupService(cache);
    const result = await service.lookup("789");

    assert.equal(result, null);
    assert.equal(cache.store.has("off:product:789"), false);
  });

  it("does NOT cache a network-level failure", async () => {
    global.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const cache = fakeCache();
    const service = new OffLookupService(cache);
    const result = await service.lookup("999");

    assert.equal(result, null);
    assert.equal(cache.store.has("off:product:999"), false);
  });

  it("returns a cached result without calling fetch again", async () => {
    let fetchCalls = 0;
    global.fetch = (async () => {
      fetchCalls++;
      return jsonResponse({ status: 0 });
    }) as unknown as typeof fetch;

    const cache = fakeCache();
    cache.store.set("off:product:111", { found: false });
    const service = new OffLookupService(cache);
    const result = await service.lookup("111");

    assert.equal(result, null);
    assert.equal(fetchCalls, 0);
  });
});
