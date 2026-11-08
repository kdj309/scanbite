import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_PROMOTE_CONFIDENCE,
  fillsNoResult,
  NUTRITION_ABS_FLOOR,
  NUTRITION_RELATIVE_TOLERANCE,
  planAfterExtraction,
  sameBrand,
  samePack,
  shouldAutoPromote,
  versionsConflict,
  type VersionSnapshot,
} from "./conflict";

const live: VersionSnapshot = {
  name: "Fixture Oats",
  brand: "ScanBite",
  nutrition: { sugar_per_100g: 20 },
  resolvedCanonicalIds: ["ing_sugar"],
  unresolvedRaw: [],
  extraction_confidence: 1,
};

describe("consensus (pending vs live)", () => {
  it("reuses live when the extraction matches the current version", () => {
    assert.equal(versionsConflict(live, { ...live }), false);
    assert.deepEqual(planAfterExtraction({ live, incoming: live }), {
      kind: "reuse_live",
    });
  });

  it("treats sugar within the relative tolerance as the same product", () => {
    assert.equal(NUTRITION_RELATIVE_TOLERANCE, 0.07);
    assert.equal(
      versionsConflict(live, {
        ...live,
        nutrition: { sugar_per_100g: 21.4 },
      }),
      false
    );
    assert.equal(
      versionsConflict(live, {
        ...live,
        nutrition: { sugar_per_100g: 22.4 },
      }),
      true
    );
  });

  it("scales tolerance to the value so sodium (mg) isn't flagged at sugar-scale noise", () => {
    const withSodium: VersionSnapshot = {
      ...live,
      nutrition: { sugar_per_100g: 20, sodium_per_100g: 450 },
    };
    // 10mg on a ~450mg reading is ~2% noise — well within a flat 1.5
    // absolute band's old false-positive territory, and within 7% here.
    assert.equal(
      versionsConflict(withSodium, {
        ...withSodium,
        nutrition: { sugar_per_100g: 20, sodium_per_100g: 460 },
      }),
      false
    );
    // A genuinely different sodium reading (~33% off) still conflicts.
    assert.equal(
      versionsConflict(withSodium, {
        ...withSodium,
        nutrition: { sugar_per_100g: 20, sodium_per_100g: 600 },
      }),
      true
    );
  });

  it("floors the tolerance near zero instead of collapsing to ~0", () => {
    const nearZero: VersionSnapshot = {
      ...live,
      nutrition: { sugar_per_100g: 0 },
    };
    assert.equal(NUTRITION_ABS_FLOOR, 0.5);
    // 0 -> 0.3g is trace-level noise, within the absolute floor.
    assert.equal(
      versionsConflict(nearZero, {
        ...nearZero,
        nutrition: { sugar_per_100g: 0.3 },
      }),
      false
    );
    // 0 -> 5g is a meaningful jump even though it's "infinitely" far in
    // relative terms.
    assert.equal(
      versionsConflict(nearZero, {
        ...nearZero,
        nutrition: { sugar_per_100g: 5 },
      }),
      true
    );
  });

  it("does not conflict when raw text differs but canonical ids match", () => {
    const incoming: VersionSnapshot = {
      ...live,
      resolvedCanonicalIds: ["ing_sugar"],
      unresolvedRaw: [],
    };
    assert.equal(versionsConflict(live, incoming), false);
  });

  it("conflicts when resolved ingredient sets differ", () => {
    const incoming: VersionSnapshot = {
      ...live,
      resolvedCanonicalIds: ["ing_sugar", "ing_palm"],
    };
    assert.equal(versionsConflict(live, incoming), true);
  });

  it("compares unresolved ingredients on normalized raw text", () => {
    const withUnresolved: VersionSnapshot = {
      ...live,
      resolvedCanonicalIds: [],
      unresolvedRaw: ["Palm Oil"],
    };
    assert.equal(
      versionsConflict(withUnresolved, {
        ...withUnresolved,
        unresolvedRaw: ["palm oil"],
      }),
      false
    );
    assert.equal(
      versionsConflict(withUnresolved, {
        ...withUnresolved,
        unresolvedRaw: ["palmolein"],
      }),
      true
    );
  });

  it("creates a pending version when nutrition disagrees beyond tolerance", () => {
    const incoming: VersionSnapshot = {
      ...live,
      nutrition: { sugar_per_100g: 24 },
      extraction_confidence: 0.5,
    };
    assert.equal(versionsConflict(live, incoming), true);
    assert.deepEqual(planAfterExtraction({ live, incoming }), {
      kind: "pending",
    });
  });

  it("plans pending for the first version without deciding auto-promote", () => {
    assert.deepEqual(
      planAfterExtraction({
        live: null,
        incoming: { ...live, extraction_confidence: 0.1 },
      }),
      { kind: "pending" }
    );
  });

  it("auto-promotes from extraction_confidence only (v1, not multi-submission consensus)", () => {
    assert.equal(
      shouldAutoPromote({ hasLiveVersion: false, extractionConfidence: 0.1 }),
      true
    );
    assert.equal(AUTO_PROMOTE_CONFIDENCE, 0.9);
    assert.equal(
      shouldAutoPromote({ hasLiveVersion: true, extractionConfidence: 0.89 }),
      false
    );
    assert.equal(
      shouldAutoPromote({ hasLiveVersion: true, extractionConfidence: 0.9 }),
      true
    );
  });

  it("auto-promotes a read that fills a product with no result, whatever its confidence", () => {
    assert.equal(
      shouldAutoPromote({
        hasLiveVersion: true,
        extractionConfidence: 0.5,
        fillsNoResult: true,
      }),
      true
    );
  });
});

describe("fillsNoResult", () => {
  const noIngredients = { ingredientCount: 0, brand: "SWAS", name: "Pickle" };

  it("fills a product with no ingredients from a read that has some", () => {
    assert.equal(
      fillsNoResult(noIngredients, {
        ingredientCount: 8,
        brand: "SWASTIKS",
        name: "Pickle",
        extractionConfidence: 0.8,
      }),
      true
    );
  });

  it("never replaces a product that already has ingredients", () => {
    assert.equal(
      fillsNoResult(
        { ingredientCount: 3, brand: "SWASTIKS", name: "Pickle" },
        {
          ingredientCount: 8,
          brand: "SWASTIKS",
          name: "Pickle",
          extractionConfidence: 0.8,
        }
      ),
      false
    );
  });

  it("needs the new read to have ingredients", () => {
    assert.equal(
      fillsNoResult(noIngredients, {
        ingredientCount: 0,
        brand: "SWAS",
        name: "Pickle",
        extractionConfidence: 0.8,
      }),
      false
    );
  });

  it("leaves a blurry read for review", () => {
    assert.equal(
      fillsNoResult(noIngredients, {
        ingredientCount: 8,
        brand: "SWASTIKS",
        name: "Pickle",
        extractionConfidence: 0.5,
      }),
      false
    );
  });

  it("leaves a different brand for review", () => {
    assert.equal(
      fillsNoResult(noIngredients, {
        ingredientCount: 8,
        brand: "Mother's",
        name: "Pickle",
        extractionConfidence: 0.8,
      }),
      false
    );
  });
});

describe("samePack", () => {
  it("matches a company on one read and its product line on the other", () => {
    // A real pair: the video read the company, the photos the line.
    assert.equal(
      samePack(
        { brand: "Sunfeast", name: "MOM'S MAGIC GHEE ROASTED CASHEW & ALMOND" },
        {
          brand: "MOM'S MAGIC",
          name: "MOM'S MAGIC ghee roasted CASHEW & ALMOND",
        }
      ),
      true
    );
  });

  it("needs the brand's whole words in the name, not letters inside one", () => {
    assert.equal(
      samePack(
        { brand: "Real", name: "Fruit juice" },
        { brand: "Kellogg's", name: "Corn Flakes Cereal" }
      ),
      false
    );
  });

  it("treats an unread brand or name as naming nothing", () => {
    assert.equal(
      samePack(
        { brand: "Priya", name: "unknown" },
        { brand: "Mother's", name: "unknown" }
      ),
      false
    );
  });

  it("still tells different packs apart", () => {
    assert.equal(
      samePack(
        { brand: "Priya", name: "Mango pickle" },
        { brand: "Mother's Recipe", name: "Lime pickle" }
      ),
      false
    );
  });
});

describe("sameBrand", () => {
  it("matches a brand read only in part, ignoring case and punctuation", () => {
    assert.equal(sameBrand("SWAS", "Swastiks"), true);
    assert.equal(sameBrand("Haldiram's", "HALDIRAMS"), true);
  });

  it("can't rule anything out when a brand wasn't visible", () => {
    assert.equal(sameBrand("unknown", "SWASTIKS"), true);
  });

  it("tells different brands apart", () => {
    assert.equal(sameBrand("Priya", "Mother's Recipe"), false);
  });

  it("needs at least 3 letters to match a brand read in part", () => {
    assert.equal(sameBrand("A", "Amul"), false);
    assert.equal(sameBrand("AM", "Amul"), false);
    assert.equal(sameBrand("AMU", "Amul"), true);
  });
});
