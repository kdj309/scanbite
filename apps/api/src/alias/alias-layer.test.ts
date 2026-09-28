import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAliasText } from "./alias-layer";

describe("normalizeAliasText", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeAliasText("  Wheat FLOUR  "), "wheat flour");
  });

  it("returns an empty string for whitespace-only input", () => {
    assert.equal(normalizeAliasText("   "), "");
  });
});
