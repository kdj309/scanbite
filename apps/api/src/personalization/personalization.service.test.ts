import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestVersionPerRule } from "./personalization.service";

describe("latestVersionPerRule", () => {
  it("keeps only the newest effective version of each rule", () => {
    const v1 = {
      id: "diabetic_sugar",
      version: "1",
      effective_from: new Date("2026-01-01"),
    };
    const v2 = {
      id: "diabetic_sugar",
      version: "2",
      effective_from: new Date("2026-12-01"),
    };
    const other = {
      id: "bp_salt",
      version: "1",
      effective_from: new Date("2026-01-01"),
    };
    assert.deepEqual(latestVersionPerRule([v2, other, v1]), [v2, other]);
    assert.deepEqual(latestVersionPerRule([v1, v2]), [v2]);
  });
});
