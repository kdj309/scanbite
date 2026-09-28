import type { RuleInput } from "./evaluate-rules";

/** HLD §6b illustration rows — evaluator tests and the dev rule_set seed. */
export const HLD_EXAMPLE_RULES: RuleInput[] = [
  {
    id: "sugar_uk_fop",
    field: "sugar_per_100g",
    operator: ">",
    threshold: 22.5,
    severity: "red",
    reason: "High total sugars (UK FoP 2016 band) — illustration, not WHO",
    applies_to: "solid",
  },
  {
    id: "fssai_cannot_claim_low_sugar",
    field: "sugar_per_100g",
    operator: ">",
    threshold: 5,
    severity: "yellow",
    reason:
      'Exceeds FSSAI "low sugars" claim threshold (Claims 2018, 5 g/100 g)',
    applies_to: "solid",
  },
  {
    id: "fssai_cannot_claim_low_sodium",
    field: "sodium_per_100g",
    operator: ">",
    threshold: 120,
    severity: "yellow",
    reason:
      'Exceeds FSSAI "low sodium" claim threshold (Claims 2018, 120 mg/100 g)',
    applies_to: "solid",
  },
  {
    id: "sugar_uk_fop_liquid",
    field: "sugar_per_100ml",
    operator: ">",
    threshold: 11.25,
    severity: "red",
    reason:
      "High total sugars for a drink (UK FoP 2016 liquid band) — illustration, not WHO",
    applies_to: "liquid",
  },
  {
    id: "fssai_cannot_claim_low_sugar_liquid",
    field: "sugar_per_100ml",
    operator: ">",
    threshold: 2.5,
    severity: "yellow",
    reason:
      'Exceeds FSSAI "low sugars" claim threshold for drinks (Claims 2018, 2.5 g/100 ml)',
    applies_to: "liquid",
  },
  {
    id: "fssai_cannot_claim_low_sodium_liquid",
    field: "sodium_per_100ml",
    operator: ">",
    threshold: 120,
    severity: "yellow",
    reason:
      'Exceeds FSSAI "low sodium" claim threshold for drinks (Claims 2018, 120 mg/100 ml)',
    applies_to: "liquid",
  },
  {
    id: "palm_oil",
    field: "ingredient_category",
    operator: "contains",
    value: "palm_oil",
    severity: "yellow",
    reason: "Contains palm oil",
  },
  {
    id: "additives",
    field: "additive_count",
    operator: ">=",
    threshold: 4,
    severity: "yellow",
    reason: "High additive count",
  },
  {
    id: "nova4",
    field: "nova_group",
    operator: "==",
    value: 4,
    severity: "yellow",
    reason:
      "Ultra-processed — ingredients/additives not typical of home cooking",
  },
];
