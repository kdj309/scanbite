import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HLD_PERSONALIZATION_SEED, HLD_RULE_SET_SEED } from "./hld-seed";

describe("HLD seed documents", () => {
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

  it("seeds the HLD §7 diabetic personalization example", () => {
    assert.equal(HLD_PERSONALIZATION_SEED.condition, "diabetic");
    assert.equal(HLD_PERSONALIZATION_SEED.field, "sugar_per_100g");
    assert.equal(HLD_PERSONALIZATION_SEED.operator, ">");
    assert.equal(HLD_PERSONALIZATION_SEED.threshold, 15);
    assert.match(HLD_PERSONALIZATION_SEED.effect, /escalate/i);
    assert.equal(
      HLD_PERSONALIZATION_SEED.message,
      "High sugar — caution advised for diabetics"
    );
  });
});
