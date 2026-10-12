import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AliasMatch } from "./alias-layer";
import { AliasService } from "./alias.service";

function layerReturning(match: AliasMatch | null) {
  return { resolve: async () => match };
}

function fakeExecOf<T>(result: T) {
  return { exec: () => Promise.resolve(result) };
}

describe("AliasService.resolveRaw", () => {
  it("returns the exact match without recording an unresolved term", async () => {
    const exact = layerReturning({ ingredientId: "id-1" });
    const unresolved = {
      findOneAndUpdate: () => {
        throw new Error(
          "should not record an unresolved term when an alias matched"
        );
      },
    };

    const service = new AliasService(exact as never, unresolved as never);
    const result = await service.resolveRaw("wheat flour");

    assert.deepEqual(result, { status: "resolved", canonical_id: "id-1" });
  });

  it("records an unresolved term (trimmed, occurrence incremented) when nothing matches", async () => {
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

    const service = new AliasService(noMatch as never, unresolved as never);
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

    const service = new AliasService(noMatch as never, unresolved as never);
    const result = await service.resolveRaw("   ");

    assert.deepEqual(result, { status: "unresolved", canonical_id: null });
    assert.equal(called, false);
  });
});
