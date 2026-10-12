import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repairNutrition } from "./nutrition-repair";

describe("repairNutrition", () => {
  it("moves a drink's per-100 g values to per-100 ml, numbers unchanged", () => {
    assert.deepEqual(
      repairNutrition({ sugar_per_100g: 9.8, sodium_per_100g: 14 }, "750 ml"),
      { sugar_per_100ml: 9.8, sodium_per_100ml: 14 }
    );
  });

  it("leaves products with both a volume and a weight alone", () => {
    const iceCream = { sugar_per_100g: 20.7, sodium_per_100g: 52 };
    assert.deepEqual(repairNutrition(iceCream, "125 mL / 67 g"), iceCream);
  });

  it("drops values 100 g/ml can't physically hold", () => {
    // OFF Yippee noodles: sodium_100g 1182.2 "g" — mg typed as grams.
    assert.deepEqual(
      repairNutrition(
        { sugar_per_100g: 3.1, sodium_per_100g: 1182200 },
        "70 g"
      ),
      { sugar_per_100g: 3.1 }
    );
    // Coca-Cola: 25 g sodium per 100 ml is more than brine can hold.
    assert.deepEqual(
      repairNutrition({ sugar_per_100ml: 11, sodium_per_100ml: 25000 }, null),
      { sugar_per_100ml: 11 }
    );
  });

  it("checks a drink against drink limits once its keys are fixed", () => {
    // 15 g sodium/100: fine for a solid (salt is 39 g), impossible for a drink.
    assert.deepEqual(
      repairNutrition({ sugar_per_100g: 5, sodium_per_100g: 15000 }, "1 l"),
      { sugar_per_100ml: 5 }
    );
  });

  it("returns normal data unchanged", () => {
    const biscuits = { sugar_per_100g: 30, sodium_per_100g: 400 };
    assert.deepEqual(repairNutrition(biscuits, "250 g"), biscuits);
    assert.deepEqual(repairNutrition({}, "500 ml"), {});
  });
});
