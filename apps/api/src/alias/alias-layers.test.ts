import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EmbeddingAliasLayer,
  ExactAliasLayer,
  SimilarityAliasLayer,
} from "./alias-layers";

function fakeQuery<T>(result: T) {
  return { exec: () => Promise.resolve(result) };
}

describe("ExactAliasLayer", () => {
  it("resolves via the alias table (layer 1) on an exact alias_text match", async () => {
    const aliases = {
      findOne: (filter: { alias_text: string }) => {
        assert.equal(filter.alias_text, "wheat flour");
        return fakeQuery({ ingredient_id: "alias-match-1" });
      },
    };
    const ingredients = { findOne: () => fakeQuery(null) };
    const layer = new ExactAliasLayer(aliases as never, ingredients as never);

    const result = await layer.resolve("  Wheat FLOUR  ");
    assert.deepEqual(result, { ingredientId: "alias-match-1", layer: 1 });
  });

  it("falls back to a case-insensitive, anchored canonical_name match when no alias exists", async () => {
    const aliases = { findOne: () => fakeQuery(null) };
    const ingredients = {
      findOne: (filter: { canonical_name: RegExp }) => {
        // The lookup text is already normalized (lowercased) before the
        // regex is built — the "i" flag is what lets it still match a
        // differently-cased canonical_name stored in the DB (e.g. "Sugar").
        assert.equal(filter.canonical_name.source, "^sugar$");
        assert.equal(filter.canonical_name.flags, "i");
        return fakeQuery({ id: "canonical-1" });
      },
    };
    const layer = new ExactAliasLayer(aliases as never, ingredients as never);

    const result = await layer.resolve("Sugar");
    assert.deepEqual(result, { ingredientId: "canonical-1", layer: 1 });
  });

  it("escapes regex special characters before using them in the canonical_name fallback", async () => {
    const ingredients = {
      findOne: (filter: { canonical_name: RegExp }) => {
        assert.equal(filter.canonical_name.source, "^sugar \\(invert\\)$");
        return fakeQuery(null);
      },
    };
    const aliases = { findOne: () => fakeQuery(null) };
    const layer = new ExactAliasLayer(aliases as never, ingredients as never);

    await layer.resolve("sugar (invert)");
  });

  it("returns null without querying for empty/whitespace-only input", async () => {
    let queried = false;
    const aliases = {
      findOne: () => {
        queried = true;
        return fakeQuery(null);
      },
    };
    const ingredients = { findOne: () => fakeQuery(null) };
    const layer = new ExactAliasLayer(aliases as never, ingredients as never);

    const result = await layer.resolve("   ");
    assert.equal(result, null);
    assert.equal(queried, false);
  });

  it("returns null when neither the alias table nor canonical_name match", async () => {
    const aliases = { findOne: () => fakeQuery(null) };
    const ingredients = { findOne: () => fakeQuery(null) };
    const layer = new ExactAliasLayer(aliases as never, ingredients as never);

    const result = await layer.resolve("completely unknown ingredient");
    assert.equal(result, null);
  });
});

describe("SimilarityAliasLayer / EmbeddingAliasLayer", () => {
  it("are documented no-op stubs (HLD: interfaces only for v1)", async () => {
    assert.equal(await new SimilarityAliasLayer().resolve("anything"), null);
    assert.equal(await new EmbeddingAliasLayer().resolve("anything"), null);
  });
});
