import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkOperator, type RuleInput } from "../../scoring/evaluate-rules";
import { HLD_PERSONALIZATION_SEEDS, HLD_RULE_SET_SEED } from "./hld-seed";

describe("HLD seed documents", () => {
  it("gives every numeric rule a number to compare", () => {
    const rules: Pick<RuleInput, "id" | "operator" | "threshold" | "value">[] =
      [...HLD_RULE_SET_SEED.rules, ...HLD_PERSONALIZATION_SEEDS];
    for (const rule of rules) {
      assert.doesNotThrow(
        () => checkOperator(rule.operator, 0, rule.threshold, rule.value),
        rule.id
      );
    }
  });

  it("seeds the HLD §6b illustration rules plus the citable FSSAI claim-gate rules", () => {
    const byId = Object.fromEntries(
      HLD_RULE_SET_SEED.rules.map((rule) => [rule.id, rule])
    );
    assert.equal(HLD_RULE_SET_SEED.version, "1");
    assert.equal(byId.sugar_uk_fop?.operator, ">");
    assert.equal(byId.sugar_uk_fop?.threshold, 22.5);
    assert.equal(byId.sugar_uk_fop?.severity, "red");
    assert.match(byId.sugar_uk_fop?.reason ?? "", /UK FoP/);
    assert.doesNotMatch(byId.sugar_uk_fop?.reason ?? "", /Exceeds WHO/);
    assert.equal(byId.fssai_cannot_claim_low_sugar?.operator, ">");
    assert.equal(byId.fssai_cannot_claim_low_sugar?.threshold, 5);
    assert.equal(byId.fssai_cannot_claim_low_sugar?.severity, "yellow");
    assert.equal(byId.fssai_cannot_claim_low_sodium?.operator, ">");
    assert.equal(byId.fssai_cannot_claim_low_sodium?.threshold, 120);
    assert.equal(byId.fssai_cannot_claim_low_sodium?.severity, "yellow");
    assert.equal(byId.sugar_uk_fop?.applies_to, "solid");
    assert.equal(byId.fssai_cannot_claim_low_sugar?.applies_to, "solid");
    assert.equal(byId.fssai_cannot_claim_low_sodium?.applies_to, "solid");
    assert.equal(byId.sugar_uk_fop_liquid?.field, "sugar_per_100ml");
    assert.equal(byId.sugar_uk_fop_liquid?.threshold, 11.25);
    assert.equal(byId.sugar_uk_fop_liquid?.severity, "red");
    assert.equal(byId.sugar_uk_fop_liquid?.applies_to, "liquid");
    assert.equal(
      byId.fssai_cannot_claim_low_sugar_liquid?.field,
      "sugar_per_100ml"
    );
    assert.equal(byId.fssai_cannot_claim_low_sugar_liquid?.threshold, 2.5);
    assert.equal(
      byId.fssai_cannot_claim_low_sugar_liquid?.applies_to,
      "liquid"
    );
    assert.equal(
      byId.fssai_cannot_claim_low_sodium_liquid?.field,
      "sodium_per_100ml"
    );
    assert.equal(byId.fssai_cannot_claim_low_sodium_liquid?.threshold, 120);
    assert.equal(
      byId.fssai_cannot_claim_low_sodium_liquid?.applies_to,
      "liquid"
    );
    assert.equal(byId.palm_oil?.operator, "contains");
    assert.equal(byId.palm_oil?.value, "palm_oil");
    assert.equal(byId.palm_oil?.severity, "yellow");
    assert.equal(byId.additives?.operator, ">=");
    assert.equal(byId.additives?.threshold, 4);
    assert.equal(byId.nova4?.operator, "==");
    assert.equal(byId.nova4?.value, 4);
    assert.equal(byId.nova4?.severity, "yellow");
  });

  it("seeds the HLD §7 diabetic example for solids and drinks", () => {
    const [solid, liquid] = HLD_PERSONALIZATION_SEEDS;
    assert.deepEqual(
      [solid.field, solid.threshold, solid.applies_to],
      ["sugar_per_100g", 15, "solid"]
    );
    assert.deepEqual(
      [liquid.field, liquid.threshold, liquid.applies_to],
      ["sugar_per_100ml", 7.5, "liquid"]
    );
    for (const rule of HLD_PERSONALIZATION_SEEDS) {
      assert.equal(rule.condition, "diabetic");
      assert.equal(rule.effect, "escalate one level");
    }
  });
});
