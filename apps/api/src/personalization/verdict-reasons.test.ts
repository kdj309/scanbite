import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvaluationResult } from "../scoring/evaluate-rules";
import type { MemberOverlay } from "./member-overlay";
import { buildVerdictReasons } from "./verdict-reasons";

const base: EvaluationResult = {
  severity: "red",
  breakdown: [
    {
      rule_id: "palm_oil",
      field: "ingredient_category",
      matched_value: ["palm_oil"],
      severity: "yellow",
      reason: "Contains palm oil",
    },
    {
      rule_id: "sugar_uk_fop",
      field: "sugar_per_100g",
      matched_value: 30,
      severity: "red",
      reason: "High total sugars",
    },
  ],
  unevaluated: [
    {
      rule_id: "fssai_cannot_claim_low_sodium",
      field: "sodium_per_100g",
      reason: "sodium_per_100g unknown",
    },
  ],
};

const noOverlay: MemberOverlay = {
  severity: "red",
  flags: [],
  unchecked: [],
  checked: [],
  flaggedTopics: [],
};

const labels = { palm_oil: "Palm oil", sugar_uk_fop: "Very high sugar" };

describe("buildVerdictReasons", () => {
  it("puts the worst flag first, so reasons[0] is the main reason", () => {
    const reasons = buildVerdictReasons({
      base,
      overlay: noOverlay,
      ruleLabels: labels,
    });
    assert.deepEqual(
      reasons.map((r) => [r.rule_id, r.kind === "flag" && r.severity, r.label]),
      [
        ["sugar_uk_fop", "red", "Very high sugar"],
        ["palm_oil", "yellow", "Palm oil"],
      ]
    );
  });

  it("on a tie, the member's condition rule beats a general rule", () => {
    const reasons = buildVerdictReasons({
      base,
      overlay: {
        severity: "red",
        flags: [
          {
            kind: "flag",
            severity: "red",
            label: "Too sweet for diabetes",
            text: "High sugar — caution advised for diabetics",
            rule_id: "diabetic_sugar_escalation",
          },
        ],
        unchecked: [],
        checked: [],
        flaggedTopics: [],
      },
      ruleLabels: labels,
    });
    assert.deepEqual(
      reasons.map((r) => r.rule_id),
      ["diabetic_sugar_escalation", "sugar_uk_fop", "palm_oil"]
    );
  });

  it("lists the member's gaps last as 'unchecked', without a severity", () => {
    const gap = {
      kind: "unchecked" as const,
      label: "Salty for BP",
      text: "Couldn't check salt for hypertension",
      rule_id: "hypertension_sodium",
    };
    const reasons = buildVerdictReasons({
      base,
      overlay: {
        severity: "red",
        flags: [],
        unchecked: [gap],
        checked: [],
        flaggedTopics: [],
      },
      ruleLabels: labels,
    });
    assert.deepEqual(reasons.at(-1), gap);
    // A general gap next to flags adds nothing, so it isn't listed.
    assert.equal(
      reasons.some((r) => r.rule_id === "fssai_cannot_claim_low_sodium"),
      false
    );
  });

  it("shows general gaps on a green verdict, named by topic", () => {
    const reasons = buildVerdictReasons({
      base: { ...base, severity: "green", breakdown: [] },
      overlay: {
        severity: "green",
        flags: [],
        unchecked: [],
        checked: [],
        flaggedTopics: [],
      },
      ruleLabels: {},
    });
    assert.deepEqual(
      reasons.map((r) => [r.kind, r.label, r.text]),
      [["unchecked", "Salt not checked", "Couldn't check salt"]]
    );
  });
});
