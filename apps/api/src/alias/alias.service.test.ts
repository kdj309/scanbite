import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AliasLayer, AliasMatch } from "./alias-layer";
import { AliasService } from "./alias.service";

function layerReturning(match: AliasMatch | null): AliasLayer {
  return { resolve: async () => match };
}

function fakeExecOf<T>(result: T) {
  return { exec: () => Promise.resolve(result) };
}

describe("AliasService.resolveRaw", () => {
  it("returns layer 1's match without calling layer 2 or 3", async () => {
    let similarityCalled = false;
    let embeddingCalled = false;
    const exact = layerReturning({ ingredientId: "id-1", layer: 1 });
    const similarity: AliasLayer = {
      resolve: async () => {
        similarityCalled = true;
        return null;
      },
    };
    const embedding: AliasLayer = {
      resolve: async () => {
        embeddingCalled = true;
        return null;
      },
    };
    const unresolved = {
      findOneAndUpdate: () => {
        throw new Error(
          "should not record an unresolved term when a layer matched"
        );
      },
    };

    const service = new AliasService(
      exact as never,
      similarity as never,
      embedding as never,
      unresolved as never
    );
    const result = await service.resolveRaw("wheat flour");

    assert.deepEqual(result, {
      status: "resolved",
      canonical_id: "id-1",
      layer: 1,
    });
    assert.equal(similarityCalled, false);
    assert.equal(embeddingCalled, false);
  });

  it("falls through layer 1 and 2 to layer 3", async () => {
    const exact = layerReturning(null);
    const similarity = layerReturning(null);
    const embedding = layerReturning({ ingredientId: "id-3", layer: 3 });
    const unresolved = {
      findOneAndUpdate: () => fakeExecOf(null),
    };

    const service = new AliasService(
      exact as never,
      similarity as never,
      embedding as never,
      unresolved as never
    );
    const result = await service.resolveRaw("mystery ingredient");

    assert.deepEqual(result, {
      status: "resolved",
      canonical_id: "id-3",
      layer: 3,
    });
  });

  it("records an unresolved term (trimmed, occurrence incremented) when no layer matches", async () => {
    let recordedFilter: unknown;
    let recordedUpdate:
      | {
          $inc: { occurrence_count: number };
          $setOnInsert: { raw_string: string; status: string };
        }
      | undefined;
    const unresolved = {
      findOneAndUpdate: (filter: unknown, update: unknown) => {
        recordedFilter = filter;
        recordedUpdate = update as typeof recordedUpdate;
        return fakeExecOf(null);
      },
    };
    const noMatch = layerReturning(null);

    const service = new AliasService(
      noMatch as never,
      noMatch as never,
      noMatch as never,
      unresolved as never
    );
    const result = await service.resolveRaw("  Some Weird Term  ");

    assert.deepEqual(result, { status: "unresolved", canonical_id: null });
    assert.deepEqual(recordedFilter, { raw_string: "Some Weird Term" });
    assert.ok(recordedUpdate);
    assert.equal(recordedUpdate.$inc.occurrence_count, 1);
    assert.equal(recordedUpdate.$setOnInsert.raw_string, "Some Weird Term");
    assert.equal(recordedUpdate.$setOnInsert.status, "pending");
  });

  it("does not record an unresolved term for empty/whitespace-only input", async () => {
    let called = false;
    const unresolved = {
      findOneAndUpdate: () => {
        called = true;
        return fakeExecOf(null);
      },
    };
    const noMatch = layerReturning(null);

    const service = new AliasService(
      noMatch as never,
      noMatch as never,
      noMatch as never,
      unresolved as never
    );
    const result = await service.resolveRaw("   ");

    assert.deepEqual(result, { status: "unresolved", canonical_id: null });
    assert.equal(called, false);
  });
});
