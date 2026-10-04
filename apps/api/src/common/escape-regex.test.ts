import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeRegex } from "./escape-regex";

describe("escapeRegex", () => {
  it("escapes regex special characters", () => {
    assert.equal(escapeRegex("a.b*c?"), "a\\.b\\*c\\?");
  });

  it("leaves plain alphanumeric text unchanged", () => {
    assert.equal(escapeRegex("Parle G"), "Parle G");
  });
});
