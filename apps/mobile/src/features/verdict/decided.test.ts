import type { Verdict } from "@foodscanner/shared";
import {
  basis,
  decidedFor,
  decidedParams,
  flaggedNutrients,
  nutritionRows,
  sourceLine,
  tiles,
} from "./decided";
import type { FlagTone } from "./decided.types";
import { ALL } from "./view";
import {
  AMMA,
  family,
  flagged as flaggedForPapa,
  papa,
  result,
  amma,
} from "./fixtures";

/** A real label: Adukale potato chips, per 100 g. */
const CHIPS = {
  energy_kcal_per_100g: 546,
  carbohydrate_per_100g: 54,
  sugar_per_100g: 3,
  total_fat_per_100g: 34,
  sodium_per_100g: 890,
};

const verdict = (flags: [string | undefined, FlagTone][]): Verdict => ({
  severity: "red",
  reasons: flags.map(([field, severity]) => ({
    kind: "flag" as const,
    severity,
    label: "x",
    text: "x",
    rule_id: "x",
    field,
  })),
  checked: [],
});

describe("how we decided", () => {
  it("names where the facts came from", () => {
    expect(sourceLine("catalog")).toBe("From Open Food Facts");
    expect(sourceLine("ai_photos")).toBe("Read by AI from the label");
    expect(sourceLine("label_check")).toBe("Checked from your label");
  });

  it("marks the nutrient a flag read, per 100 g or 100 ml", () => {
    const flagged = flaggedNutrients(
      verdict([
        ["sodium_per_100g", "red"],
        ["sugar_per_100ml", "yellow"],
        [undefined, "red"],
      ])
    );
    expect(Object.fromEntries(flagged)).toEqual({
      sodium: "red",
      sugar: "yellow",
    });
  });

  it("keeps the worst tone when two flags read one nutrient", () => {
    // Reasons arrive worst first.
    const flagged = flaggedNutrients(
      verdict([
        ["sodium_per_100g", "red"],
        ["sodium_per_100g", "yellow"],
      ])
    );
    expect(flagged.get("sodium")).toBe("red");
  });

  it("shows the four key numbers, sodium in its flag's tone", () => {
    expect(tiles(CHIPS, new Map([["sodium", "yellow"]]))).toEqual([
      { name: "Sugar", value: "3 g", tone: undefined },
      { name: "Sodium", value: "890 mg", tone: "yellow" },
      { name: "Fat", value: "34 g", tone: undefined },
      { name: "Energy", value: "546", tone: undefined },
    ]);
  });

  it("lists only what the label gave, in label order", () => {
    expect(
      nutritionRows(CHIPS, new Map()).map((row) => [row.name, row.sub])
    ).toEqual([
      ["Energy", false],
      ["Carbohydrate", false],
      ["Sugar", true],
      ["Fat", false],
      ["Sodium", false],
    ]);
  });

  it("says which basis the label used", () => {
    expect(basis(CHIPS)).toBe("100 g");
    expect(basis({ sugar_per_100ml: 11.9 })).toBe("100 ml");
  });

  it("shows a dash for a key number the label didn't give", () => {
    expect(tiles({ sugar_per_100g: 3 }, new Map())[1].value).toBe("–");
  });

  describe("decidedFor", () => {
    it("explains the person picked on the verdict", () => {
      expect(decidedFor(flaggedForPapa, family, AMMA).person).toBe(amma);
    });

    it("explains the person it's worst for when All was picked", () => {
      const shown = decidedFor(flaggedForPapa, family, undefined);
      expect(shown.person).toBe(papa);
      expect(shown.verdict?.severity).toBe("red");
    });

    it("falls back to the worst-off person for an id no longer in the result", () => {
      expect(decidedFor(flaggedForPapa, family, "gone").person).toBe(papa);
    });

    it("has nothing to explain or mark with no verdicts", () => {
      const empty = result({ severity: "green", member_id: null }, []);
      const shown = decidedFor(empty, family, undefined);
      expect(shown.verdict).toBeUndefined();
      expect(shown.flagged.size).toBe(0);
    });
  });

  describe("decidedParams", () => {
    const labelCheck = {
      ...flaggedForPapa,
      product: { ...flaggedForPapa.product, source: "label_check" as const },
    };

    it("looks a catalogue product up by barcode, for the person picked", () => {
      expect(decidedParams(flaggedForPapa, "890123", AMMA)).toEqual({
        barcode: "890123",
        member: AMMA,
      });
    });

    it("looks a label check up by its id", () => {
      expect(decidedParams(labelCheck, undefined, AMMA)).toEqual({
        check: labelCheck.product.product_version_id,
        member: AMMA,
      });
    });

    it("sends no member for All", () => {
      expect(decidedParams(flaggedForPapa, "890123", ALL)).toEqual({
        barcode: "890123",
      });
    });

    it("has nowhere to go without a barcode or a label check", () => {
      expect(decidedParams(flaggedForPapa, undefined, AMMA)).toBeUndefined();
    });
  });
});
