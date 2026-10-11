import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitCrossContact } from "./cross-contact";

describe("splitCrossContact", () => {
  it("splits at the first warning, whatever the wording", () => {
    for (const warning of [
      "May contain traces of nuts",
      "MAY CONTAINS CRUSTACEAN",
      "Traces of sesame",
      "Made on shared equipment with milk",
      "Processed in a facility that also handles peanuts",
      // Common on Indian packs:
      "Manufactured in a facility that also processes peanuts",
      "Made in a unit that also handles milk",
      "Packed in a plant that also packs sesame",
      "Produced on the same line as egg products",
    ]) {
      assert.deepEqual(splitCrossContact(["Sugar", warning, "Milk"]), {
        recipe: ["Sugar"],
        crossContact: [warning, "Milk"],
      });
    }
  });

  it("keeps the ingredient a warning was run into", () => {
    assert.deepEqual(splitCrossContact(["Sugar", "Egg. May contain nuts"]), {
      recipe: ["Sugar", "Egg."],
      crossContact: ["May contain nuts"],
    });
  });

  it("leaves a list without a warning alone", () => {
    assert.deepEqual(splitCrossContact(["Sugar", "Milk"]), {
      recipe: ["Sugar", "Milk"],
      crossContact: [],
    });
  });
});
