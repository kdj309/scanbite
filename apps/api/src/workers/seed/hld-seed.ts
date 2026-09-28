import { HLD_EXAMPLE_RULES } from "../../scoring/hld-example-rules";

export const HLD_RULE_SET_SEED = {
  version: "1",
  effective_from: new Date("2026-01-01T00:00:00.000Z"),
  effective_to: null as Date | null,
  rules: HLD_EXAMPLE_RULES,
};

export const HLD_PERSONALIZATION_SEED = {
  version: "1",
  effective_from: new Date("2026-01-01T00:00:00.000Z"),
  effective_to: null as Date | null,
  condition: "diabetic",
  field: "sugar_per_100g",
  operator: ">" as const,
  threshold: 15,
  effect: "escalate one level",
  message: "High sugar — caution advised for diabetics",
};
