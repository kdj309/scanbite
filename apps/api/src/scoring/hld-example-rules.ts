import type { RuleInput } from "./evaluate-rules";

/** HLD §6b illustration rows — used for evaluator tests, not auto-seeded here. */
export const HLD_EXAMPLE_RULES: RuleInput[] = [
  {
    id: "sugar_who",
    field: "sugar_per_100g",
    operator: ">",
    threshold: 22.5,
    severity: "red",
    reason: "Exceeds WHO free-sugar guidance",
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
