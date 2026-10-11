import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aliasList, namesAlias } from "./alias-match";

describe("namesAlias", () => {
  it("matches however the pattern or the label is capitalised", () => {
    const carmine = aliasList({ include: [/\bINS 120\b/] });
    assert.equal(namesAlias("Colour (ins 120)", carmine), true);
    assert.equal(namesAlias("COLOUR (INS 120)", carmine), true);
  });

  it("removes look-alikes before matching, but not real mentions", () => {
    const milk = aliasList({
      include: [/\bmilk\b/],
      exclude: [/\bcoconut milk\b/, /\bsoy milk\b/],
    });
    assert.equal(namesAlias("Coconut Milk", milk), false);
    assert.equal(namesAlias("Coconut milk, milk solids", milk), true);
  });
});
