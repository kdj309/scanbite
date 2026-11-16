import type { RuleInput } from "./evaluate-rules";

/**
 * WHO Nutrient Profile Model for the South-East Asia Region (2017), groups
 * 7 and 8 (scoring/dessert-groups.ts): over a limit is "too high" for that
 * kind of dessert. Per 100 g, or per 100 ml as declared. Only sugar and
 * salt for now: WHO also sets fat (8 / 7 g) and energy (230 kcal), but the
 * catalogue import keeps only sugar and sodium, so every catalogue dessert
 * would read "fat not checked" (fat is deferred for all foods anyway).
 */
export const WHO_DESSERT_LIMITS = [
  { form: "frozen_dessert" as const, name: "frozen desserts", sugar: 12 },
  { form: "curded_dessert" as const, name: "curded dairy desserts", sugar: 6 },
];

const WHO_DESSERT_RULES: RuleInput[] = WHO_DESSERT_LIMITS.flatMap(
  ({ form, name, sugar }) => {
    const limit = (what: string) =>
      `Over the WHO South-East Asia limit for ${name} (${what} per 100 g)`;
    return [
      {
        id: `who_${form}_sugar`,
        label: "High sugar",
        field: "sugar_per_100g",
        operator: ">" as const,
        threshold: sugar,
        severity: "yellow" as const,
        reason: limit(`${sugar} g sugar`),
        applies_to: form,
      },
      {
        id: `who_${form}_sodium`,
        label: "High salt",
        field: "sodium_per_100g",
        operator: ">" as const,
        threshold: 100,
        severity: "yellow" as const,
        reason: limit("100 mg sodium"),
        applies_to: form,
      },
    ];
  }
);

/** HLD §6b illustration rows, plus the WHO dessert limits — evaluator
 *  tests and the dev rule_set seed. */
export const HLD_EXAMPLE_RULES: RuleInput[] = [
  {
    id: "sugar_uk_fop",
    label: "Very high sugar",
    field: "sugar_per_100g",
    operator: ">",
    threshold: 22.5,
    severity: "red",
    reason: "High total sugars (UK FoP 2016 band) — illustration, not WHO",
    applies_to: "solid",
  },
  {
    id: "fssai_cannot_claim_low_sugar",
    label: "High sugar",
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
    label: "High salt",
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
    label: "Very high sugar",
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
    label: "High sugar",
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
    label: "High salt",
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
    label: "Palm oil",
    field: "ingredient_category",
    operator: "contains",
    value: "palm_oil",
    severity: "yellow",
    reason: "Contains palm oil",
  },
  {
    id: "additives",
    label: "Many additives",
    field: "additive_count",
    operator: ">=",
    threshold: 4,
    severity: "yellow",
    reason: "High additive count",
  },
  {
    id: "nova4",
    label: "Ultra-processed",
    field: "nova_group",
    operator: "==",
    value: 4,
    severity: "yellow",
    reason:
      "Ultra-processed — ingredients/additives not typical of home cooking",
  },
  ...WHO_DESSERT_RULES,
];
